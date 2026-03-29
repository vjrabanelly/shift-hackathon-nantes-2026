import { ElevenLabsTTSService } from './elevenLabsTts';
import { normalizeVoiceText } from './voiceMessageNormalizer';

export interface SpeechRequest {
  text: string;
  interrupt?: boolean;
  rate?: number;
}

interface QueuedSpeechRequest extends SpeechRequest {
  onComplete?: () => void;
}

export interface TextToSpeechConfig {
  useElevenLabs: boolean;
  elevenLabsVoiceId: string;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

const DEFAULT_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export class TextToSpeechService {
  private queue: QueuedSpeechRequest[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentRequestText = '';
  private lastSpokenText = '';
  private lastSpokenAt = 0;
  private lastCompletedText = '';
  private readonly defaultRate = 1;
  private readonly dedupeWindowMs = 2500;
  private readonly elevenLabsService = new ElevenLabsTTSService();
  private isPlaying = false;
  private playbackGeneration = 0;
  private onPlaybackStart?: () => void;
  private onPlaybackEnd?: () => void;

  configure(config: Partial<TextToSpeechConfig>): void {
    const env = import.meta.env as Record<string, string | undefined>;
    const envVoiceId = env.VITE_ELEVENLABS_VOICE_ID || '';
    const apiKey = env.VITE_ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY || '';
    const voiceId = config.elevenLabsVoiceId || envVoiceId || DEFAULT_ELEVENLABS_VOICE_ID;

    this.elevenLabsService.configure({
      apiKey,
      useElevenLabs: (config.useElevenLabs ?? true) && !!apiKey,
      voiceId,
    });

    if (config.onPlaybackStart !== undefined) {
      this.onPlaybackStart = config.onPlaybackStart;
    }
    if (config.onPlaybackEnd !== undefined) {
      this.onPlaybackEnd = config.onPlaybackEnd;
    }
  }

  isSupported(): boolean {
    return (
      this.elevenLabsService.isAvailable() ||
      (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined')
    );
  }

  speak(request: SpeechRequest): void {
    if (!this.isSupported()) {
      return;
    }

    const normalizedText = normalizeVoiceText(request.text);
    if (!normalizedText) {
      return;
    }
    this.enqueue({
      text: normalizedText,
      interrupt: !!request.interrupt,
      rate: request.rate ?? this.defaultRate,
    });
  }

  async speakAndWait(request: SpeechRequest, timeoutMs = 1200): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    const normalizedText = normalizeVoiceText(request.text);
    if (!normalizedText) {
      return;
    }

    await new Promise<void>(resolve => {
      const timeoutId = window.setTimeout(() => resolve(), timeoutMs);

      this.enqueue(
        {
          text: normalizedText,
          interrupt: !!request.interrupt,
          rate: request.rate ?? this.defaultRate,
        },
        () => {
          clearTimeout(timeoutId);
          resolve();
        },
      );
    });
  }

  stop(): void {
    this.playbackGeneration += 1;
    this.queue = [];
    this.currentUtterance = null;
    this.currentRequestText = '';
    this.isPlaying = false;
    this.elevenLabsService.stop();
    if (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.cancel();
    }
  }

  repeatLast(): boolean {
    if (!this.lastCompletedText) {
      return false;
    }

    this.speak({
      text: this.lastCompletedText,
      interrupt: true,
    });
    return true;
  }

  private flushQueue(): void {
    if (!this.isSupported()) {
      return;
    }

    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    const nextRequest = this.queue.shift();
    if (!nextRequest) {
      return;
    }
    this.isPlaying = true;
    this.currentRequestText = nextRequest.text;
    void this.playRequest(nextRequest);
  }

  private enqueue(request: SpeechRequest, onComplete?: () => void): void {
    const now = Date.now();
    if (this.lastSpokenText === request.text && now - this.lastSpokenAt < this.dedupeWindowMs) {
      onComplete?.();
      return;
    }

    if (this.currentRequestText === request.text) {
      onComplete?.();
      return;
    }

    if (this.queue.some(queuedRequest => queuedRequest.text === request.text)) {
      onComplete?.();
      return;
    }

    if (request.interrupt) {
      this.stop();
    }

    this.queue.push({
      ...request,
      onComplete,
    });

    this.flushQueue();
  }

  private async playRequest(nextRequest: QueuedSpeechRequest): Promise<void> {
    const playbackGeneration = this.playbackGeneration;

    this.onPlaybackStart?.();

    try {
      let played = false;

      if (this.elevenLabsService.isAvailable()) {
        played = await this.elevenLabsService.speakAndWait(nextRequest);
      }

      if (!played && playbackGeneration === this.playbackGeneration) {
        await this.playWithBrowserSpeech(nextRequest);
      }

      if (playbackGeneration !== this.playbackGeneration) {
        return;
      }

      this.lastSpokenText = nextRequest.text;
      this.lastSpokenAt = Date.now();
      this.lastCompletedText = nextRequest.text;
    } finally {
      this.currentUtterance = null;
      this.currentRequestText = '';
      this.isPlaying = false;
      this.onPlaybackEnd?.();
      nextRequest.onComplete?.();
      this.flushQueue();
    }
  }

  private async playWithBrowserSpeech(nextRequest: QueuedSpeechRequest): Promise<void> {
    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
      return;
    }

    await new Promise<void>(resolve => {
      const utterance = new SpeechSynthesisUtterance(nextRequest.text);
      utterance.rate = nextRequest.rate ?? this.defaultRate;
      utterance.lang = 'fr-FR';

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(voice => voice.lang === utterance.lang) ??
        voices.find(voice => voice.lang.toLowerCase().startsWith('fr')) ??
        voices.find(voice => voice.lang.startsWith(utterance.lang.split('-')[0])) ??
        null;

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }
}
