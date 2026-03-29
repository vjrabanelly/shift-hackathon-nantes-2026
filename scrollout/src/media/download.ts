/**
 * ECHA Media Download — Télécharge des vidéos depuis des URLs CDN Instagram.
 */
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const MEDIA_DIR = path.join(__dirname, '..', '..', 'data', 'media');
const TIMEOUT_MS = 30_000;
const MAX_SIZE_MB = 50;

export interface DownloadResult {
  filePath: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * Télécharge une vidéo depuis une URL CDN Instagram.
 * Retourne le chemin local du fichier téléchargé.
 */
export async function downloadVideo(url: string, postId: string): Promise<DownloadResult> {
  if (!existsSync(MEDIA_DIR)) {
    mkdirSync(MEDIA_DIR, { recursive: true });
  }

  const safeId = postId.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 60);
  const ext = url.includes('.mp4') ? '.mp4' : '.video';
  const filePath = path.join(MEDIA_DIR, `${safeId}${ext}`);

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    const req = client.get(url, { timeout: TIMEOUT_MS }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadVideo(res.headers.location, postId).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }

      const contentType = res.headers['content-type'] || 'video/mp4';
      const contentLength = parseInt(res.headers['content-length'] || '0', 10);
      if (contentLength > MAX_SIZE_MB * 1024 * 1024) {
        reject(new Error(`Video too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB > ${MAX_SIZE_MB}MB`));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_SIZE_MB * 1024 * 1024) {
          req.destroy();
          reject(new Error(`Video too large (streaming): exceeded ${MAX_SIZE_MB}MB`));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        writeFileSync(filePath, buffer);
        resolve({ filePath, sizeBytes: buffer.length, contentType });
      });

      res.on('error', reject);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Download timed out after ${TIMEOUT_MS}ms`));
    });

    req.on('error', reject);
  });
}

/**
 * Supprime un fichier média téléchargé.
 */
export function cleanupMedia(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch { /* best effort */ }
}
