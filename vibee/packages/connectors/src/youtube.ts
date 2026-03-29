import type { MusicConnector, Track } from './types'
import { spawn } from 'child_process'

// Inline copy of searchYouTube (same logic as apps/api/src/lib/ytdlp.ts)
// Using inline to avoid cross-package relative imports that may cause TypeScript issues.
async function searchYouTube(query: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [`ytsearch1:${query}`, '--get-id', '--no-playlist'])
    let stdout = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', () => {})  // ignore
    proc.on('close', () => resolve(stdout.trim() || null))
    proc.on('error', reject)
  })
}

export class YouTubeConnector implements MusicConnector {
  name = 'youtube'

  async resolve(query: string): Promise<Track | null> {
    try {
      const youtubeId = await searchYouTube(query)
      if (!youtubeId) return null

      return {
        title: query,        // Placeholder — enriched later by MusicBrainz
        artist: '',          // Unknown until metadata enrichment
        youtube_id: youtubeId,
        source: 'youtube',
      }
    } catch {
      // yt-dlp not available, network error, etc.
      return null
    }
  }
}
