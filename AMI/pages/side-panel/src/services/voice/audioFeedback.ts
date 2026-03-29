export enum AudioCue {
  MicActivate = 'mic_activate',
  MicDeactivate = 'mic_deactivate',
  Heartbeat = 'heartbeat',
  TaskComplete = 'task_complete',
  TaskError = 'task_error',
  UserTurnStart = 'user_turn_start',
}

export class AudioFeedbackService {
  private audioContext: AudioContext | null = null;
  private heartbeatIntervalId: number | null = null;
  private enabled = true;

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopHeartbeat();
    }
  }

  play(cue: AudioCue): void {
    if (!this.enabled) return;

    try {
      switch (cue) {
        case AudioCue.MicActivate:
          this.playTone({ startFreq: 440, endFreq: 880, durationMs: 100, type: 'sine', volume: 0.3 });
          break;
        case AudioCue.MicDeactivate:
          this.playTone({ startFreq: 880, endFreq: 440, durationMs: 100, type: 'sine', volume: 0.3 });
          break;
        case AudioCue.Heartbeat:
          this.playTone({ startFreq: 300, endFreq: 300, durationMs: 50, type: 'sine', volume: 0.08 });
          break;
        case AudioCue.TaskComplete:
          this.playChime();
          break;
        case AudioCue.TaskError:
          this.playTone({ startFreq: 220, endFreq: 180, durationMs: 400, type: 'sine', volume: 0.25 });
          break;
        case AudioCue.UserTurnStart:
          this.playTone({ startFreq: 660, endFreq: 660, durationMs: 80, type: 'sine', volume: 0.15 });
          break;
      }
    } catch {
      // Silently ignore audio errors
    }
  }

  startHeartbeat(intervalMs = 3000): void {
    this.stopHeartbeat();
    if (!this.enabled) return;

    this.heartbeatIntervalId = window.setInterval(() => {
      this.play(AudioCue.Heartbeat);
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  dispose(): void {
    this.stopHeartbeat();
    if (this.audioContext?.state !== 'closed') {
      void this.audioContext?.close();
    }
    this.audioContext = null;
  }

  private playTone(params: {
    startFreq: number;
    endFreq: number;
    durationMs: number;
    type: OscillatorType;
    volume: number;
  }): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = params.type;
    osc.frequency.setValueAtTime(params.startFreq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(params.endFreq, ctx.currentTime + params.durationMs / 1000);

    gain.gain.setValueAtTime(params.volume, ctx.currentTime);
    // Fade out at the end to avoid clicks
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + params.durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + params.durationMs / 1000);
  }

  private playChime(): void {
    const ctx = this.getContext();
    const durationMs = 300;

    // Play two harmonious tones together (C5 + E5)
    [523, 659].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + durationMs / 1000);
    });
  }
}
