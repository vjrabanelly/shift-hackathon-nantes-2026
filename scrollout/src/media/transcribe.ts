/**
 * ECHA Transcription — Abstraction pour transcrire de l'audio en texte.
 * Supporte Whisper (local via CLI) et Whisper API (OpenAI).
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import path from 'path';
import https from 'https';

export interface TranscriptionResult {
  text: string;
  language: string;
  durationSec: number;
  segments: Array<{ start: number; end: number; text: string }>;
  provider: 'whisper-local' | 'whisper-api';
}

export interface TranscriptionProvider {
  name: string;
  transcribe(audioPath: string): Promise<TranscriptionResult>;
}

// ─── Whisper Local (whisper.cpp CLI) ─────────────────────────────────

export function createWhisperLocalProvider(options: {
  modelPath?: string; // chemin vers le modèle .bin (défaut: auto-detect)
  language?: string;  // 'fr', 'en', 'auto'
} = {}): TranscriptionProvider {
  const { language = 'fr' } = options;

  return {
    name: 'whisper-local',
    async transcribe(audioPath: string): Promise<TranscriptionResult> {
      if (!existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Try whisper CLI (Python package: openai-whisper)
      const outputBase = audioPath.replace(/\.[^.]+$/, '');
      const langFlag = language === 'auto' ? '' : `--language ${language}`;

      try {
        execSync(
          `whisper "${audioPath}" --model small --output_format json --output_dir "${path.dirname(audioPath)}" ${langFlag}`,
          { stdio: 'pipe', timeout: 300_000 }, // 5min timeout
        );
      } catch (err) {
        // Fallback: try whisper.cpp main binary
        try {
          const modelPath = options.modelPath || findWhisperModel();
          execSync(
            `whisper-cpp -m "${modelPath}" -f "${audioPath}" -oj -of "${outputBase}" -l ${language}`,
            { stdio: 'pipe', timeout: 300_000 },
          );
        } catch {
          throw new Error(`Whisper local failed: ${err instanceof Error ? err.message : err}`);
        }
      }

      // Parse JSON output
      const jsonPath = `${outputBase}.json`;
      if (!existsSync(jsonPath)) {
        throw new Error(`Whisper produced no JSON output at ${jsonPath}`);
      }

      const result = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      unlinkSync(jsonPath); // cleanup

      const segments = (result.segments || []).map((s: any) => ({
        start: s.start || 0,
        end: s.end || 0,
        text: (s.text || '').trim(),
      }));

      return {
        text: result.text || segments.map((s: { text: string }) => s.text).join(' '),
        language: result.language || language,
        durationSec: segments.length > 0 ? segments[segments.length - 1].end : 0,
        segments,
        provider: 'whisper-local',
      };
    },
  };
}

function findWhisperModel(): string {
  const candidates = [
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.cache', 'whisper', 'ggml-small.bin'),
    path.join(process.env.HOME || process.env.USERPROFILE || '', 'whisper-models', 'ggml-small.bin'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('Whisper model not found. Install openai-whisper or place ggml-small.bin in ~/.cache/whisper/');
}

// ─── Whisper API (OpenAI) ────────────────────────────────────────────

export function createWhisperAPIProvider(options: {
  apiKey?: string;
  language?: string;
} = {}): TranscriptionProvider {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const { language = 'fr' } = options;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY required for Whisper API provider');
  }

  return {
    name: 'whisper-api',
    async transcribe(audioPath: string): Promise<TranscriptionResult> {
      if (!existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      const audioData = readFileSync(audioPath);
      const filename = path.basename(audioPath);

      // Build multipart form data
      const boundary = '----EchaWhisperBoundary' + Date.now();
      const parts: Buffer[] = [];

      // File part
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/wav\r\n\r\n`
      ));
      parts.push(audioData);
      parts.push(Buffer.from('\r\n'));

      // Model part
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
      ));

      // Language part
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`
      ));

      // Response format
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`
      ));

      // Timestamp granularities
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nsegment\r\n`
      ));

      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.openai.com',
          path: '/v1/audio/transcriptions',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
          },
          timeout: 120_000,
        }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode !== 200) {
              reject(new Error(`Whisper API error ${res.statusCode}: ${responseBody}`));
              return;
            }

            try {
              const result = JSON.parse(responseBody);
              const segments = (result.segments || []).map((s: any) => ({
                start: s.start || 0,
                end: s.end || 0,
                text: (s.text || '').trim(),
              }));

              resolve({
                text: result.text || '',
                language: result.language || language,
                durationSec: result.duration || 0,
                segments,
                provider: 'whisper-api',
              });
            } catch (err) {
              reject(new Error(`Failed to parse Whisper API response: ${err}`));
            }
          });
          res.on('error', reject);
        });

        req.on('timeout', () => { req.destroy(); reject(new Error('Whisper API timed out')); });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    },
  };
}
