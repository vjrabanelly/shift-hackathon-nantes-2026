import { AgentMessage, AgentSession, CollectivePosition, Event, GetEventResponse, GetQueueResponse, Guest, JoystickPosition, QueuedTrack, Request, SearchCandidate, Track, TrackSource } from '@partyjam/shared';
interface EventState {
    event: Event;
    guests: Map<string, Guest>;
    tracks: Map<string, Track>;
    requests: Map<string, Request>;
    sessions: Map<string, AgentSession>;
    joysticks: Map<string, JoystickPosition>;
    collective: CollectivePosition;
}
export declare class PartyStore {
    private readonly events;
    constructor();
    ensureEvent(eventId: string): EventState;
    ensureGuest(eventId: string, guestId?: string, displayName?: string): Guest;
    getGuest(eventId: string, guestId: string): Guest;
    getEventResponse(eventId: string): GetEventResponse;
    getQueueResponse(eventId: string): GetQueueResponse;
    getNowPlaying(eventId: string): {
        track: Track;
        started_at: string;
        elapsed_seconds: number;
    } | null;
    getQueuedTracks(eventId: string): QueuedTrack[];
    getQueueTracks(eventId: string): Track[];
    getCollectivePosition(eventId: string): CollectivePosition;
    updateJoystick(eventId: string, guestId: string, valence: number, energy: number): CollectivePosition;
    hydrateEventContext(input: {
        event: Event;
        guest?: Guest | null;
        tracks: Track[];
        collective: CollectivePosition;
    }): void;
    recordRequest(eventId: string, guestId: string, rawText: string): Request;
    getLatestRequestForGuest(eventId: string, guestId: string): Request | null;
    resolveRequest(eventId: string, requestId: string, trackId: string): void;
    ensureSession(eventId: string, guestId: string): AgentSession;
    resetSession(eventId: string, guestId: string): AgentSession;
    appendMessage(eventId: string, guestId: string, message: Omit<AgentMessage, 'id' | 'created_at'>): AgentSession;
    replacePendingCandidates(eventId: string, guestId: string, candidates: SearchCandidate[]): AgentSession;
    rejectCandidate(eventId: string, guestId: string, candidateId: string): AgentSession;
    selectPreviewSource(eventId: string, guestId: string, candidateId: string, sourceId: string): {
        session: AgentSession;
        candidate: SearchCandidate;
        source: TrackSource;
    };
    confirmCandidate(eventId: string, guestId: string, candidateId: string): {
        session: AgentSession;
        track: Track;
    };
    getSession(eventId: string, guestId: string): AgentSession;
    getEvent(eventId: string): Event;
}
export declare function buildRequestSummary(store: PartyStore, eventId: string, guestId: string): {
    session: AgentSession;
    now_playing: {
        track: Track;
        started_at: string;
        elapsed_seconds: number;
    } | null;
    queue: QueuedTrack[];
};
export declare function createDefaultStore(): PartyStore;
export {};
//# sourceMappingURL=store.d.ts.map