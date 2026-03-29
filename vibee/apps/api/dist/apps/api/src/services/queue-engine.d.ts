interface CollectiveSnapshot {
    valence: number;
    energy: number;
}
export declare class QueueEngine {
    private static instance;
    static getInstance(): QueueEngine;
    start(): void;
    computeCollective(positions: CollectiveSnapshot[]): CollectiveSnapshot;
    private extractOutputText;
    private buildAiOrderedQueue;
    reorder(eventId: string): Promise<void>;
}
export {};
//# sourceMappingURL=queue-engine.d.ts.map