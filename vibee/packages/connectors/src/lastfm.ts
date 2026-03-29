import type { MusicConnector, Track } from './types'

const LASTFM_BASE = 'http://ws.audioscrobbler.com/2.0'

export class LastFmConnector implements MusicConnector {
  name = 'lastfm'

  private get apiKey(): string {
    return process.env.LASTFM_API_KEY ?? ''
  }

  async resolve(query: string): Promise<Track | null> {
    if (!this.apiKey) return null

    try {
      const url = new URL(LASTFM_BASE)
      url.searchParams.set('method', 'track.search')
      url.searchParams.set('track', query)
      url.searchParams.set('api_key', this.apiKey)
      url.searchParams.set('format', 'json')
      url.searchParams.set('limit', '1')

      const res = await fetch(url.toString())
      if (!res.ok) return null

      const data = await res.json()
      const track = data.results?.trackmatches?.track?.[0]
      if (!track) return null

      return {
        title: track.name,
        artist: track.artist,
        source: 'lastfm',
      }
    } catch {
      return null
    }
  }

  /**
   * Get similar artists for gap-filling queries.
   * Returns top 5 similar artist names, or empty array on error.
   */
  async getSimilarArtists(artist: string): Promise<string[]> {
    if (!this.apiKey) return []

    try {
      const url = new URL(LASTFM_BASE)
      url.searchParams.set('method', 'artist.getSimilar')
      url.searchParams.set('artist', artist)
      url.searchParams.set('api_key', this.apiKey)
      url.searchParams.set('format', 'json')
      url.searchParams.set('limit', '5')

      const res = await fetch(url.toString())
      if (!res.ok) return []

      const data = await res.json()
      const similar = data.similarartists?.artist ?? []
      return similar.map((a: { name: string }) => a.name).slice(0, 5)
    } catch {
      return []
    }
  }
}
