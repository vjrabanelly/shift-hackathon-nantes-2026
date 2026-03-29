import type { Track as ConnectorTrack } from '@partyjam/connectors';
export declare function resolveCoverArt(track: ConnectorTrack): Promise<string | null>;
export declare class TrackResolver {
    static hydrateQueuedTrack(input: {
        eventId: string;
        trackId: string;
        title: string;
        artist: string;
        youtubeId?: string | null;
        connectorTrack?: ConnectorTrack | null;
    }): Promise<boolean>;
    static resolve(rawText: string, eventId: string, guestId: string, requestId: string): Promise<void>;
}
//# sourceMappingURL=track-resolver.d.ts.map