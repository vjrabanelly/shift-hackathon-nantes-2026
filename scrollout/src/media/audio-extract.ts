/**
 * ECHA Audio Extract — Extrait l'audio d'une vidéo via ffmpeg.
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';

export interface AudioExtractResult {
  audioPath: string;
  format: 'wav' | 'mp3';
  durationSec: number;
}

/**
 * Vérifie que ffmpeg est installé et accessible.
 */
export function checkFfmpeg(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extrait l'audio d'une vidéo en WAV 16kHz mono (format optimal pour Whisper).
 * Supprime le fichier vidéo source après extraction si cleanupVideo=true.
 */
export function extractAudio(
  videoPath: string,
  options: { cleanupVideo?: boolean; format?: 'wav' | 'mp3' } = {},
): AudioExtractResult {
  const { cleanupVideo = true, format = 'wav' } = options;

  if (!existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const audioPath = videoPath.replace(/\.[^.]+$/, `.${format}`);

  // Extract audio: 16kHz mono WAV (optimal for Whisper)
  const ffmpegArgs = format === 'wav'
    ? `-i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`
    : `-i "${videoPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -q:a 2 "${audioPath}"`;

  try {
    execSync(`ffmpeg -y ${ffmpegArgs}`, { stdio: 'pipe', timeout: 60_000 });
  } catch (err) {
    throw new Error(`ffmpeg extraction failed: ${err instanceof Error ? err.message : err}`);
  }

  if (!existsSync(audioPath)) {
    throw new Error(`Audio extraction produced no output: ${audioPath}`);
  }

  // Get duration
  let durationSec = 0;
  try {
    const probe = execSync(
      `ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { stdio: 'pipe', timeout: 10_000 },
    );
    durationSec = parseFloat(probe.toString().trim()) || 0;
  } catch { /* duration is optional */ }

  if (cleanupVideo) {
    try { unlinkSync(videoPath); } catch { /* best effort */ }
  }

  return { audioPath, format, durationSec };
}
