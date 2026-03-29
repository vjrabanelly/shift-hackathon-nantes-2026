import type { MusicConnector, CoverArtConnector, Track } from './types'

const MB_BASE = 'https://musicbrainz.org/ws/2'
const MB_HEADERS = {
  'User-Agent': 'PartyJAM/1.0 (hackathon@example.com)',
  'Accept': 'application/json',
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class MusicBrainzMetadataConnector implements MusicConnector {
  name = 'musicbrainz'

  async resolve(query: string): Promise<Track | null> {
    // Respect MusicBrainz 1 req/sec rate limit
    await sleep(1100)

    try {
      const url = `${MB_BASE}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=1`
      const res = await fetch(url, { headers: MB_HEADERS })

      if (!res.ok) return null

      const data = await res.json()
      const recording = data.recordings?.[0]
      if (!recording) return null

      return {
        title: recording.title ?? query,
        artist: recording['artist-credit']?.[0]?.artist?.name ?? '',
        duration: recording.length ? Math.round(recording.length / 1000) : undefined,
        source: 'musicbrainz',
      }
    } catch {
      return null
    }
  }
}

export class MusicBrainzCoverArtConnector implements CoverArtConnector {
  name = 'musicbrainz-cover-art'

  async resolve(track: Track): Promise<string | null> {
    // Respect MusicBrainz 1 req/sec rate limit
    await sleep(1100)

    try {
      const query = `${track.title} ${track.artist}`
      const url = `${MB_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=1`
      const res = await fetch(url, { headers: MB_HEADERS })

      if (!res.ok) return null

      const data = await res.json()
      const release = data.releases?.[0]
      if (!release?.id) return null

      const coverUrl = `https://coverartarchive.org/release/${release.id}/front-250`

      // Validate that the cover actually exists
      try {
        const check = await fetch(coverUrl, { method: 'HEAD' })
        return check.ok ? coverUrl : null
      } catch {
        return null
      }
    } catch {
      return null
    }
  }
}
