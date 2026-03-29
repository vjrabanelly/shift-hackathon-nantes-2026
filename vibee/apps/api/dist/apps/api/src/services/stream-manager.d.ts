import type { Track } from '@partyjam/shared';
import { PlannedTransition } from './transition-planner';
type StreamTrack = Pick<Track, 'id' | 'event_id' | 'title' | 'artist' | 'duration' | 'youtube_id' | 'file_path' | 'cover_url' | 'status' | 'position' | 'started_at' | 'created_at'>;
interface TimelineInput {
    kind: 'track' | 'transition';
    path: string;
    trimStart?: number;
    trimEnd?: number;
}
export declare class StreamManager {
    private static instance;
    private readonly eventStates;
    private readonly transitionPlanner;
    static getInstance(): StreamManager;
    init(): void;
    getStreamUrl(eventId: string): string;
    startStream(eventId: string): Promise<void>;
    buildAcrossfadeFilter(trackCount: number): string;
    syncEventStream(eventId: string): Promise<void>;
    advanceToNextTrack(eventId: string): Promise<void>;
    advanceTrackInDb(eventId: string): Promise<void>;
    buildTimelineInputs(tracks: StreamTrack[], transitions: Array<PlannedTransition | null>): TimelineInput[];
    buildFilterGraph(inputs: TimelineInput[]): string;
    isRunning(eventId?: string): boolean;
    private getEventState;
    private syncEventStreamInternal;
    private ensurePlayableNowPlaying;
    private getPlayingTrack;
    private promoteFirstQueuedTrack;
    private getQueuedTracks;
    private renderHls;
    private spawnFfmpegBuild;
    private stopEventStream;
    private hasTrackBody;
    private normalizeTime;
    private formatSeconds;
    private findFirstUsableTrack;
    private filterUsableTracks;
    private isUsableTrackFile;
}
export {};
//# sourceMappingURL=stream-manager.d.ts.map