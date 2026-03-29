import type { SearchCandidate, SearchTrace, Track, VibeConfig } from '@partyjam/shared';
export interface MusicSearchContext {
    query: string;
    event_id: string;
    guest_id: string;
    vibe_config?: VibeConfig;
    joystick?: {
        valence: number;
        energy: number;
    };
    now_playing?: Track | null;
    queue: Track[];
    rejected_candidate_ids: string[];
    reference_candidate?: {
        title: string;
        artist: string;
    };
    intents?: string[];
    max_candidates?: number;
}
export interface MusicSearchResult {
    candidates: SearchCandidate[];
    search_traces: SearchTrace[];
}
export declare function searchMusicCandidates(context: MusicSearchContext): Promise<MusicSearchResult>;
//# sourceMappingURL=music-agent.d.ts.map