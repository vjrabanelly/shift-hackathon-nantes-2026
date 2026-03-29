export class SpeechCaptureService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private stopTimeoutId: number | null = null;
  private onStopCallback: ((audioBlob: Blob | null) => void) | null = null;

  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
    );
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording' ?? false;
  }

  async start(onStop: (audioBlob: Blob | null) => void, maxDurationMs = 2 * 60 * 1000): Promise<void> {
    if (!SpeechCaptureService.isSupported()) {
      throw new Error('Browser does not support audio recording.');
    }

    if (this.isRecording()) {
      return;
    }

    this.onStopCallback = onStop;
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const audioBlob = this.audioChunks.length > 0 ? new Blob(this.audioChunks, { type: 'audio/webm' }) : null;
      const callback = this.onStopCallback;

      this.cleanup();
      callback?.(audioBlob);
    };

    this.mediaRecorder.start();
    this.stopTimeoutId = window.setTimeout(() => {
      this.stop();
    }, maxDurationMs);
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  cancel(): void {
    this.onStopCallback = null;

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    } else {
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.stopTimeoutId) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }

    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

export function convertBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read recorded audio.'));

    reader.readAsDataURL(blob);
  });
}
