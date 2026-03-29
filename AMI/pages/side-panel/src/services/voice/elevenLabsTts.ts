import type { SpeechRequest } from './textToSpeech';

export interface ElevenLabsTTSConfig {
  apiKey: string;
  useElevenLabs: boolean;
  voiceId: string;
  modelId?: string;
  timeoutMs?: number;
}

const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_TIMEOUT_MS = 10000;

export class ElevenLabsTTSService {
  private config: ElevenLabsTTSConfig = {
    apiKey: '',
    useElevenLabs: false,
    voiceId: '',
    modelId: DEFAULT_MODEL_ID,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private currentAbortController: AbortController | null = null;

  configure(config: Partial<ElevenLabsTTSConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      modelId: config.modelId ?? this.config.modelId ?? DEFAULT_MODEL_ID,
      timeoutMs: config.timeoutMs ?? this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof Audio !== 'undefined' &&
      this.config.useElevenLabs &&
      !!this.config.apiKey &&
      !!this.config.voiceId
    );
  }

  async speakAndWait(request: SpeechRequest): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    const text = request.text.trim();
    if (!text) {
      return false;
    }

    this.stop();
    const controller = new AbortController();
    this.currentAbortController = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.config.voiceId)}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: this.config.modelId ?? DEFAULT_MODEL_ID,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs request failed with status ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      const audioBlob = new Blob([arrayBuffer], { type: contentType });
      this.currentObjectUrl = URL.createObjectURL(audioBlob);
      this.currentAudio = new Audio(this.currentObjectUrl);

      await new Promise<void>((resolve, reject) => {
        if (!this.currentAudio) {
          resolve();
          return;
        }

        this.currentAudio.onended = () => resolve();
        this.currentAudio.onerror = () => reject(new Error('Failed to play ElevenLabs audio.'));
        this.currentAudio.play().catch(reject);
      });

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
      this.cleanup();
    }
  }

  stop(): void {
    this.currentAbortController?.abort();
    this.cleanup();
  }

  private cleanup(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    this.currentAbortController = null;
  }
}
