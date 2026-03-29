/**
 * Wake word detector using the browser's built-in Web Speech API.
 * Runs continuously in the background, listening for "hey l'ami" (or variants).
 * Zero API cost - uses Chrome's native speech recognition engine.
 * When the wake word is detected, fires the onWakeWord callback.
 */

const WAKE_PHRASES = [
  'hey ami',
  "hey l'ami",
  'hé ami',
  "hé l'ami",
  'hey la mi',
  'hey lami',
  'he ami',
  "he l'ami",
  'ok ami',
  "ok l'ami",
  'dis ami',
  "dis l'ami",
  'hey amy',
  'hey amie',
];

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export class WakeWordDetector {
  private recognition: any = null;
  private running = false;
  private onWakeWord: (() => void) | null = null;
  private restartTimeoutId: number | null = null;

  static isSupported(): boolean {
    return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  start(onWakeWord: () => void): void {
    if (!WakeWordDetector.isSupported()) return;
    if (this.running) return;

    this.onWakeWord = onWakeWord;
    this.running = true;
    this.createAndStart();
  }

  stop(): void {
    this.running = false;
    this.onWakeWord = null;
    if (this.restartTimeoutId !== null) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
  }

  /** Pause detection (e.g. when dialogue orchestrator is active and owns the mic) */
  pause(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
  }

  /** Resume detection after pause */
  resume(): void {
    if (this.running && !this.recognition) {
      this.scheduleRestart(300);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private createAndStart(): void {
    if (!this.running) return;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'fr-FR';
    this.recognition.maxAlternatives = 3;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // Check all alternatives
        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript.toLowerCase().trim();
          if (this.matchesWakeWord(transcript)) {
            // Wake word detected!
            this.pause();
            this.onWakeWord?.();
            return;
          }
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are normal, just restart
      if (event.error === 'not-allowed') {
        // Mic permission denied - stop trying
        console.error('[WakeWord] Microphone permission denied');
        this.running = false;
        return;
      }
      // For all other errors, restart after a delay
      this.scheduleRestart(1000);
    };

    this.recognition.onend = () => {
      // Chrome stops recognition periodically, restart it
      if (this.running) {
        this.scheduleRestart(300);
      }
    };

    try {
      this.recognition.start();
    } catch {
      this.scheduleRestart(1000);
    }
  }

  private scheduleRestart(delayMs: number): void {
    if (this.restartTimeoutId !== null) {
      clearTimeout(this.restartTimeoutId);
    }
    this.restartTimeoutId = window.setTimeout(() => {
      this.restartTimeoutId = null;
      if (this.running) {
        this.createAndStart();
      }
    }, delayMs);
  }

  private matchesWakeWord(transcript: string): boolean {
    const normalized = transcript
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['']/g, "'")
      .trim();

    return WAKE_PHRASES.some(phrase => normalized.includes(phrase));
  }
}
