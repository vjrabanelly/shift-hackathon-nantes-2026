// ─── Enums ────────────────────────────────────────────────────────────────

export type TrackStatus = 'queued' | 'playing' | 'played' | 'removed'
export type RequestStatus = 'pending' | 'resolved' | 'failed'
export type TrackSourcePlatform = 'youtube' | 'spotify' | 'soundcloud' | 'deezer' | 'unknown'

// ─── Core domain models (mirror the Supabase schema) ──────────────────────

export interface Event {
  id: string                    // uuid
  admin_token: string           // tok_ + 32 hex chars
  name: string
  stream_url?: string
  vibe_config: VibeConfig
  genre_rules: GenreRules
  seed_playlist: SeedTrack[]
  created_at: string            // ISO 8601
}

export interface VibeConfig {
  context?: string              // free-text event description
  energy_profile?: 'chill' | 'moderate' | 'intense' | 'chill_to_intense'
  genre_allow?: string[]
  genre_block?: string[]
}

export interface GenreRules {
  allow: string[]
  block: string[]
}

export interface SeedTrack {
  title: string
  artist: string
  youtube_id?: string
}

export interface Guest {
  id: string                    // uuid
  event_id: string              // uuid, FK → events.id
  display_name: string
  emoji: string
  joined_at: string             // ISO 8601
}

export interface EssentiaFeatures {
  bpm: number
  key: string                   // e.g. "C major"
  energy: number                // 0.0 – 1.0
  valence?: number              // -1.0 – 1.0
  mood: string                  // "happy" | "sad" | "aggressive" | "relaxed"
  duration?: number
  tunebat_url?: string
}

export interface AudioMetrics {
  bpm?: number
  energy?: number
  valence?: number
  danceability?: number
  popularity?: number
  play_count?: number
  key?: string
  source?: string
}

export interface TrackSource {
  id: string
  platform: TrackSourcePlatform
  external_id: string
  url: string
  embed_url?: string
  preview_url?: string
  label: string
  playable: boolean
  quality_score?: number
}

export interface Track {
  id: string                    // uuid
  event_id: string              // uuid, FK → events.id
  title: string
  artist: string
  duration?: number             // seconds, null until analyzed
  youtube_id?: string
  file_path?: string            // absolute path on API server disk
  cover_url?: string
  essentia_features?: EssentiaFeatures | null
  primary_source?: TrackSource
  linked_sources?: TrackSource[]
  audio_metrics?: AudioMetrics | null
  added_by: string              // guest UUID or 'ai'
  status: TrackStatus
  position: number              // lower = plays sooner
  started_at?: string           // ISO 8601, set when status → 'playing'
  created_at: string            // ISO 8601
}

export interface JoystickPosition {
  id: string                    // uuid
  event_id: string              // uuid
  guest_id: string              // uuid
  valence: number               // -1.0 (sad) to 1.0 (happy)
  energy: number                // -1.0 (chill) to 1.0 (intense)
  updated_at: string            // ISO 8601
}

export interface Request {
  id: string                    // uuid
  event_id: string              // uuid
  guest_id: string              // uuid
  raw_text: string
  resolved_track_id?: string    // uuid, FK → tracks.id
  status: RequestStatus
  created_at: string            // ISO 8601
}

export interface CollectivePosition {
  valence: number               // average across all guests
  energy: number                // average across all guests
}

export interface SearchCandidate {
  id: string
  title: string
  artist: string
  artwork_url?: string
  genres: string[]
  confidence: number
  why_it_matches: string
  summary: string
  source_platforms: TrackSourcePlatform[]
  primary_source: TrackSource
  sources: TrackSource[]
  metrics?: AudioMetrics | null
  verification_status?: 'unverified' | 'needs_confirmation' | 'verified'
  verification_notes?: string[]
  already_in_queue?: boolean
  duplicate_of_track_id?: string
}

export interface SearchTrace {
  id: string
  agent: string
  tool: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  query?: string
  summary: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  created_at: string
  candidates?: SearchCandidate[]
  search_traces?: SearchTrace[]
  decision?: 'idle' | 'previewing' | 'confirmed' | 'rejected' | 'queued'
}

export interface AgentSession {
  id: string
  event_id: string
  guest_id: string
  opened_at: string
  updated_at: string
  messages: AgentMessage[]
  pending_candidates: SearchCandidate[]
  rejected_candidate_ids: string[]
  selected_preview_by_candidate: Record<string, string>
}
