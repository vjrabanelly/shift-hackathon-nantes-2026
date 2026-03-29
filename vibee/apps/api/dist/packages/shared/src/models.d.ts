export type TrackStatus = 'queued' | 'playing' | 'played' | 'removed';
export type RequestStatus = 'pending' | 'resolved' | 'failed';
export type TrackSourcePlatform = 'youtube' | 'spotify' | 'soundcloud' | 'deezer' | 'unknown';
export interface Event {
    id: string;
    admin_token: string;
    name: string;
    stream_url?: string;
    vibe_config: VibeConfig;
    genre_rules: GenreRules;
    seed_playlist: SeedTrack[];
    created_at: string;
}
export interface VibeConfig {
    context?: string;
    energy_profile?: 'chill' | 'moderate' | 'intense' | 'chill_to_intense';
    genre_allow?: string[];
    genre_block?: string[];
}
export interface GenreRules {
    allow: string[];
    block: string[];
}
export interface SeedTrack {
    title: string;
    artist: string;
    youtube_id?: string;
}
export interface Guest {
    id: string;
    event_id: string;
    display_name: string;
    emoji: string;
    joined_at: string;
}
export interface EssentiaFeatures {
    bpm: number;
    key: string;
    energy: number;
    valence?: number;
    mood: string;
    duration?: number;
    tunebat_url?: string;
}
export interface AudioMetrics {
    bpm?: number;
    energy?: number;
    valence?: number;
    danceability?: number;
    popularity?: number;
    play_count?: number;
    key?: string;
    source?: string;
}
export interface TrackSource {
    id: string;
    platform: TrackSourcePlatform;
    external_id: string;
    url: string;
    embed_url?: string;
    preview_url?: string;
    label: string;
    playable: boolean;
    quality_score?: number;
}
export interface Track {
    id: string;
    event_id: string;
    title: string;
    artist: string;
    duration?: number;
    youtube_id?: string;
    file_path?: string;
    cover_url?: string;
    essentia_features?: EssentiaFeatures | null;
    primary_source?: TrackSource;
    linked_sources?: TrackSource[];
    audio_metrics?: AudioMetrics | null;
    added_by: string;
    status: TrackStatus;
    position: number;
    started_at?: string;
    created_at: string;
}
export interface JoystickPosition {
    id: string;
    event_id: string;
    guest_id: string;
    valence: number;
    energy: number;
    updated_at: string;
}
export interface Request {
    id: string;
    event_id: string;
    guest_id: string;
    raw_text: string;
    resolved_track_id?: string;
    status: RequestStatus;
    created_at: string;
}
export interface CollectivePosition {
    valence: number;
    energy: number;
}
export interface SearchCandidate {
    id: string;
    title: string;
    artist: string;
    artwork_url?: string;
    genres: string[];
    confidence: number;
    why_it_matches: string;
    summary: string;
    source_platforms: TrackSourcePlatform[];
    primary_source: TrackSource;
    sources: TrackSource[];
    metrics?: AudioMetrics | null;
    verification_status?: 'unverified' | 'needs_confirmation' | 'verified';
    verification_notes?: string[];
    already_in_queue?: boolean;
    duplicate_of_track_id?: string;
}
export interface SearchTrace {
    id: string;
    agent: string;
    tool: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    query?: string;
    summary: string;
}
export interface AgentMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    created_at: string;
    candidates?: SearchCandidate[];
    search_traces?: SearchTrace[];
    decision?: 'idle' | 'previewing' | 'confirmed' | 'rejected' | 'queued';
}
export interface AgentSession {
    id: string;
    event_id: string;
    guest_id: string;
    opened_at: string;
    updated_at: string;
    messages: AgentMessage[];
    pending_candidates: SearchCandidate[];
    rejected_candidate_ids: string[];
    selected_preview_by_candidate: Record<string, string>;
}
//# sourceMappingURL=models.d.ts.map