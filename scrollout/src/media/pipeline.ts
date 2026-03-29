/**
 * ECHA Media Pipeline — Orchestre download → extract audio → transcribe pour les vidéos.
 * Utilisé par le pipeline d'enrichissement quand --with-audio est activé.
 */
import { downloadVideo, cleanupMedia } from './download';
import { extractAudio, checkFfmpeg } from './audio-extract';
import { TranscriptionProvider, TranscriptionResult } from './transcribe';

export interface MediaPipelineResult {
  transcription: TranscriptionResult | null;
  videoDurationSec: number;
  error?: string;
}

export interface MediaPipelineOptions {
  transcriptionProvider: TranscriptionProvider;
  cleanupAfter?: boolean; // supprimer les fichiers temporaires (défaut: true)
}

/**
 * Pipeline complet : videoUrl → download → extract audio → transcribe.
 * Retourne la transcription ou null si échec.
 */
export async function processVideoMedia(
  videoUrl: string,
  postId: string,
  options: MediaPipelineOptions,
): Promise<MediaPipelineResult> {
  const { transcriptionProvider, cleanupAfter = true } = options;

  // Vérifier ffmpeg
  if (!checkFfmpeg()) {
    return { transcription: null, videoDurationSec: 0, error: 'ffmpeg not installed' };
  }

  let videoPath = '';
  let audioPath = '';

  try {
    // 1. Download video
    console.log(`[media] Downloading video for ${postId.substring(0, 30)}...`);
    const download = await downloadVideo(videoUrl, postId);
    videoPath = download.filePath;
    console.log(`[media] Downloaded: ${(download.sizeBytes / 1024).toFixed(0)}KB`);

    // 2. Extract audio
    console.log(`[media] Extracting audio...`);
    const audio = extractAudio(videoPath, { cleanupVideo: cleanupAfter });
    audioPath = audio.audioPath;
    console.log(`[media] Audio extracted: ${audio.durationSec.toFixed(1)}s`);

    // 3. Transcribe
    console.log(`[media] Transcribing with ${transcriptionProvider.name}...`);
    const transcription = await transcriptionProvider.transcribe(audioPath);
    console.log(`[media] Transcribed: "${transcription.text.substring(0, 80)}..."`);

    return {
      transcription,
      videoDurationSec: audio.durationSec,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[media] Pipeline error for ${postId}: ${message}`);
    return { transcription: null, videoDurationSec: 0, error: message };
  } finally {
    // Cleanup
    if (cleanupAfter) {
      if (audioPath) cleanupMedia(audioPath);
      if (videoPath) cleanupMedia(videoPath);
    }
  }
}
