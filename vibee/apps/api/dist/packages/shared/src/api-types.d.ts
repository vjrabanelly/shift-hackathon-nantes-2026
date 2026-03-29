import { AgentSession, CollectivePosition, Event, SearchCandidate, SeedTrack, Track, TrackSource, VibeConfig } from './models';
export interface CreateEventRequest {
    name: string;
    vibe_config: VibeConfig;
    seed_playlist?: SeedTrack[];
}
export interface CreateEventResponse {
    event_id: string;
    admin_token: string;
    join_url: string;
    qr_url: string;
    stream_url?: string;
}
export interface GetEventResponse {
    event: Event;
    now_playing: NowPlayingState | null;
    queue: QueuedTrack[];
    history: QueuedTrack[];
    guest_count: number;
    collective_joystick: CollectivePosition;
}
export interface NowPlayingState {
    track: Track;
    started_at: string;
    elapsed_seconds: number;
}
export interface QueuedTrack {
    track: Track;
    position: number;
    added_by_display?: string;
}
export interface JoinEventRequest {
    display_name: string;
}
export interface JoinEventResponse {
    guest_id: string;
    display_name: string;
    emoji: string;
    event_id: string;
}
export interface CreateRequestBody {
    guest_id: string;
    raw_text: string;
}
export interface CreateRequestResponse {
    request_id: string;
    status: 'pending';
}
export interface GetQueueResponse {
    now_playing: NowPlayingState | null;
    queued: QueuedTrack[];
}
export interface SkipTrackResponse {
    ok: boolean;
}
export interface UpdateJoystickRequest {
    guest_id: string;
    valence: number;
    energy: number;
}
export interface UpdateJoystickResponse {
    collective: CollectivePosition;
}
export interface GetAgentSessionResponse {
    session: AgentSession;
    now_playing: NowPlayingState | null;
    queue: QueuedTrack[];
}
export interface ResetAgentSessionRequest {
    guest_id: string;
}
export interface ResetAgentSessionResponse {
    session: AgentSession;
}
export interface CreateAgentTurnRequest {
    guest_id: string;
    message: string;
    joystick?: {
        valence: number;
        energy: number;
    };
}
export interface CreateAgentTurnResponse {
    session: AgentSession;
}
export interface SelectAgentPreviewRequest {
    guest_id: string;
    source_id: string;
}
export interface SelectAgentPreviewResponse {
    session: AgentSession;
    candidate: SearchCandidate;
    selected_source: TrackSource;
}
export interface ConfirmAgentCandidateRequest {
    guest_id: string;
}
export interface ConfirmAgentCandidateResponse {
    session: AgentSession;
    queue: QueuedTrack[];
}
export interface RejectAgentCandidateRequest {
    guest_id: string;
}
export interface RejectAgentCandidateResponse {
    session: AgentSession;
}
//# sourceMappingURL=api-types.d.ts.map