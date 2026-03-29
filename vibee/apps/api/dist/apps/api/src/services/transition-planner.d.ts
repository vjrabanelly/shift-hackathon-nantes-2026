import type { Track } from '@partyjam/shared';
type TransitionTrack = Pick<Track, 'id' | 'title' | 'artist' | 'file_path' | 'youtube_id'>;
export interface PlannedTransition {
    score: number;
    transitionType: string;
    previewPath: string;
    components: Record<string, number>;
    reasons: string[];
    sourceWindow: {
        start: number;
        end: number;
        duration: number;
    };
    targetWindow: {
        start: number;
        end: number;
        duration: number;
    };
}
export declare class TransitionPlanner {
    private readonly cache;
    plan(source: TransitionTrack, target: TransitionTrack): Promise<PlannedTransition | null>;
    private resolveInput;
    private run;
}
export {};
//# sourceMappingURL=transition-planner.d.ts.map