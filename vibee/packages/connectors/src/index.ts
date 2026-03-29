// Types
export type { Track, EssentiaFeatures, MusicConnector, CoverArtConnector } from './types'
export type { MusicSearchContext, MusicSearchResult } from './music-agent'

// Connectors (imported as they are implemented in subsequent stories)
export { YouTubeConnector } from './youtube'       // story 4.2
export { MusicBrainzMetadataConnector, MusicBrainzCoverArtConnector } from './musicbrainz'  // story 4.3
export { LastFmConnector } from './lastfm'         // story 4.4
export { ItunesCoverArtConnector, YouTubeThumbnailConnector } from './cover-art'  // story 4.5
export { searchMusicCandidates } from './music-agent'
