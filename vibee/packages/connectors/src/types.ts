// Note: These types intentionally duplicate @partyjam/shared to avoid circular
// package dependencies. The connectors package is meant to be self-contained.
// If this causes friction, import Track from @partyjam/shared instead.

export interface Track {
  title: string
  artist: string
  duration?: number       // seconds
  youtube_id?: string
  cover_url?: string
  essentia_features?: EssentiaFeatures
  source: string          // 'youtube' | 'musicbrainz' | 'lastfm' | etc.
}

export interface EssentiaFeatures {
  bpm: number
  key: string             // e.g. "C major"
  energy: number          // 0.0 – 1.0
  valence?: number        // -1.0 – 1.0
  mood: string            // "happy" | "sad" | "aggressive" | "relaxed"
  duration?: number
}

export interface MusicConnector {
  name: string
  resolve(query: string): Promise<Track | null>
}

export interface CoverArtConnector {
  name: string
  resolve(track: Track): Promise<string | null>  // returns URL or null
}
