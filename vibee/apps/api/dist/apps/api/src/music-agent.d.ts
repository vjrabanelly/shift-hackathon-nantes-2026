import { SearchCandidate, SearchTrace, TrackSource } from '@partyjam/shared';
import { PartyStore } from './store';
interface AgentTurnResult {
    session: ReturnType<PartyStore['getSession']>;
    assistant_message: string;
    candidates: SearchCandidate[];
    search_traces: SearchTrace[];
}
export declare function createAgentTurn(store: PartyStore, eventId: string, guestId: string, message: string, joystick?: {
    valence: number;
    energy: number;
}): Promise<AgentTurnResult>;
export declare function rejectCandidate(store: PartyStore, eventId: string, guestId: string, candidateId: string): Promise<AgentTurnResult>;
export declare function selectCandidatePreview(store: PartyStore, eventId: string, guestId: string, candidateId: string, sourceId: string): {
    session: ReturnType<PartyStore['getSession']>;
    candidate: SearchCandidate;
    selected_source: TrackSource;
};
export declare function confirmCandidate(store: PartyStore, eventId: string, guestId: string, candidateId: string): {
    session: import("@partyjam/shared").AgentSession;
    track: import("@partyjam/shared").Track;
};
export {};
//# sourceMappingURL=music-agent.d.ts.map