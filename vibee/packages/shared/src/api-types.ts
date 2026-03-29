import {
  AgentSession,
  CollectivePosition,
  Event,
  SearchCandidate,
  SeedTrack,
  Track,
  TrackSource,
  VibeConfig
} from './models'

// ─── POST /events ──────────────────────────────────────────────────────────
export interface CreateEventRequest {
  name: string
  vibe_config: VibeConfig
  seed_playlist?: SeedTrack[]
}

export interface CreateEventResponse {
  event_id: string
  admin_token: string
  join_url: string
  qr_url: string
  stream_url?: string
}

// ─── GET /events/:id ──────────────────────────────────────────────────────
export interface GetEventResponse {
  event: Event
  now_playing: NowPlayingState | null
  queue: QueuedTrack[]
  history: QueuedTrack[]
  guest_count: number
  collective_joystick: CollectivePosition
}

export interface NowPlayingState {
  track: Track
  started_at: string
  elapsed_seconds: number
}

export interface QueuedTrack {
  track: Track
  position: number
  added_by_display?: string     // e.g. "🎸 Sarah" or "🤖 AI"
}

// ─── POST /events/:id/join ────────────────────────────────────────────────
export interface JoinEventRequest {
  display_name: string
}

export interface JoinEventResponse {
  guest_id: string
  display_name: string
  emoji: string
  event_id: string
}

// ─── POST /events/:id/requests ────────────────────────────────────────────
export interface CreateRequestBody {
  guest_id: string
  raw_text: string
}

export interface CreateRequestResponse {
  request_id: string
  status: 'pending'
}

// ─── GET /events/:id/queue ────────────────────────────────────────────────
export interface GetQueueResponse {
  now_playing: NowPlayingState | null
  queued: QueuedTrack[]
}

// ─── POST /events/:id/queue/next ─────────────────────────────────────────
// Request: no body; requires x-admin-token header
export interface SkipTrackResponse {
  ok: boolean
}

// ─── PATCH /events/:id/joystick ──────────────────────────────────────────
export interface UpdateJoystickRequest {
  guest_id: string
  valence: number               // -1.0 to 1.0
  energy: number                // -1.0 to 1.0
}

export interface UpdateJoystickResponse {
  collective: CollectivePosition
}

// ─── GET /events/:id/agent/session ────────────────────────────────────────
export interface GetAgentSessionResponse {
  session: AgentSession
  now_playing: NowPlayingState | null
  queue: QueuedTrack[]
}

// ─── POST /events/:id/agent/session/reset ─────────────────────────────────
export interface ResetAgentSessionRequest {
  guest_id: string
}

export interface ResetAgentSessionResponse {
  session: AgentSession
}

// ─── POST /events/:id/agent/turns ─────────────────────────────────────────
export interface CreateAgentTurnRequest {
  guest_id: string
  message: string
  joystick?: {
    valence: number
    energy: number
  }
}

export interface CreateAgentTurnResponse {
  session: AgentSession
}

// ─── POST /events/:id/agent/candidates/:candidateId/preview/select ───────
export interface SelectAgentPreviewRequest {
  guest_id: string
  source_id: string
}

export interface SelectAgentPreviewResponse {
  session: AgentSession
  candidate: SearchCandidate
  selected_source: TrackSource
}

// ─── POST /events/:id/agent/candidates/:candidateId/confirm ──────────────
export interface ConfirmAgentCandidateRequest {
  guest_id: string
}

export interface ConfirmAgentCandidateResponse {
  session: AgentSession
  queue: QueuedTrack[]
}

// ─── POST /events/:id/agent/candidates/:candidateId/reject ───────────────
export interface RejectAgentCandidateRequest {
  guest_id: string
}

export interface RejectAgentCandidateResponse {
  session: AgentSession
}

// ─── GET /stream/playlist.m3u8 ────────────────────────────────────────────
// Returns raw M3U8 playlist text (no JSON wrapper)
// ─── GET /stream/segment_NNN.ts ──────────────────────────────────────────
// Returns raw MPEG-TS segment binary
