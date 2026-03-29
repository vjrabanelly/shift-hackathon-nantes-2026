import { convertBlobToDataUrl } from './speechCapture';

export interface ContinuousListeningConfig {
  maxRecordingMs: number;
  silenceTimeoutMs: number;
  endOfSpeechMs: number;
  speechThresholdDb: number;
  speechMinMs: number;
}

export type ContinuousListeningEvent =
  | { type: 'utterance_end'; audioBlob: Blob; audioDataUrl: string }
  | { type: 'silence_timeout' }
  | { type: 'voice_start' }
  | { type: 'interrupt' }
  | { type: 'error'; error: Error };

const DEFAULT_CONFIG: ContinuousListeningConfig = {
  maxRecordingMs: 15000,
  silenceTimeoutMs: 5000,
  endOfSpeechMs: 2000,
  speechThresholdDb: -22,
  speechMinMs: 600,
};

/**
 * Continuous listening with end-of-speech VAD.
 * Recording starts when orchestrator calls startNextRecording().
 * VAD monitors volume and stops recording after endOfSpeechMs of silence
 * following detected speech. No VAD for speech START (avoids false triggers).
 */
export class ContinuousListeningService {
  private config: ContinuousListeningConfig;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private onEvent: ((event: ContinuousListeningEvent) => void) | null = null;
  private active = false;
  private muted = false;
  private recording = false;
  private recordingTimeoutId: number | null = null;
  private silenceTimerId: number | null = null;
  private vadIntervalId: number | null = null;

  // VAD state
  private userSpeaking = false;
  private speechStartTime: number | null = null;
  private silenceStartTime: number | null = null;

  constructor(config?: Partial<ContinuousListeningConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
    );
  }

  async start(onEvent: (event: ContinuousListeningEvent) => void): Promise<void> {
    if (this.active) return;
    if (!ContinuousListeningService.isSupported()) {
      throw new Error('Browser does not support audio recording');
    }

    this.onEvent = onEvent;
    this.active = true;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Setup audio analysis for VAD
    this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
  }

  stop(): void {
    this.active = false;
    this.recording = false;
    this.stopVad();
    this.clearTimers();
    this.stopRecordingInternal(false);

    this.source?.disconnect();
    this.source = null;
    this.analyser = null;
    if (this.audioContext?.state !== 'closed') {
      void this.audioContext?.close();
    }
    this.audioContext = null;

    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.onEvent = null;
  }

  mute(): void {
    this.muted = true;
    this.stopVad();
    this.stopRecordingInternal(false);
    this.clearTimers();
  }

  unmute(): void {
    this.muted = false;
  }

  startNextRecording(): void {
    if (!this.stream || !this.active || this.muted || this.recording) return;

    this.recording = true;
    this.userSpeaking = false;
    this.speechStartTime = null;
    this.silenceStartTime = null;
    this.audioChunks = [];

    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.recording = false;

      if (this.audioChunks.length > 0 && !this.muted && this.active) {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];

        convertBlobToDataUrl(audioBlob)
          .then(audioDataUrl => {
            this.onEvent?.({ type: 'utterance_end', audioBlob, audioDataUrl });
          })
          .catch(error => {
            this.onEvent?.({
              type: 'error',
              error: error instanceof Error ? error : new Error('Failed to convert audio'),
            });
          });
      } else {
        this.audioChunks = [];
      }
    };

    this.mediaRecorder.start(500);
    this.onEvent?.({ type: 'voice_start' });

    // Start VAD monitoring for end-of-speech
    this.startVad();

    // Fallback: auto-stop after max duration
    this.recordingTimeoutId = window.setTimeout(() => {
      this.finishRecording();
    }, this.config.maxRecordingMs);

    // Silence timeout for "silence prompt" (no speech at all)
    this.startSilenceTimer();
  }

  finishRecording(): void {
    this.stopVad();
    this.clearTimers();
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isRecording(): boolean {
    return this.recording;
  }

  updateConfig(config: Partial<ContinuousListeningConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private startVad(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const thresholdLinear = Math.pow(10, this.config.speechThresholdDb / 20);

    this.vadIntervalId = window.setInterval(() => {
      if (!this.active || !this.analyser || this.muted || !this.recording) return;

      this.analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const isLoud = rms > thresholdLinear;

      if (isLoud) {
        this.silenceStartTime = null;

        if (!this.userSpeaking) {
          this.userSpeaking = true;
          this.speechStartTime = Date.now();
        }
      } else if (this.userSpeaking) {
        // User was speaking and now it's quiet
        if (!this.silenceStartTime) {
          this.silenceStartTime = Date.now();
        }

        const speechDuration = Date.now() - (this.speechStartTime || Date.now());
        const silenceDuration = Date.now() - this.silenceStartTime;

        // Only trigger end-of-speech if user spoke for at least speechMinMs
        if (speechDuration >= this.config.speechMinMs && silenceDuration >= this.config.endOfSpeechMs) {
          this.finishRecording();
        }
      }
    }, 16); // ~60Hz monitoring
  }

  private stopVad(): void {
    if (this.vadIntervalId !== null) {
      clearInterval(this.vadIntervalId);
      this.vadIntervalId = null;
    }
    this.userSpeaking = false;
    this.speechStartTime = null;
    this.silenceStartTime = null;
  }

  private stopRecordingInternal(emit: boolean): void {
    this.stopVad();
    this.clearTimers();
    this.recording = false;

    if (this.mediaRecorder?.state === 'recording') {
      if (!emit) {
        this.audioChunks = [];
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = () => {
          this.audioChunks = [];
        };
      }
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
  }

  private startSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimerId = window.setTimeout(() => {
      if (this.active && !this.muted) {
        this.onEvent?.({ type: 'silence_timeout' });
      }
    }, this.config.silenceTimeoutMs);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimerId !== null) {
      clearTimeout(this.silenceTimerId);
      this.silenceTimerId = null;
    }
  }

  private clearTimers(): void {
    if (this.recordingTimeoutId !== null) {
      clearTimeout(this.recordingTimeoutId);
      this.recordingTimeoutId = null;
    }
    this.clearSilenceTimer();
  }
}
