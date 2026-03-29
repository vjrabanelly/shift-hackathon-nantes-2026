import type { MusicConnector, Track } from './types';
export declare class YouTubeConnector implements MusicConnector {
    name: string;
    resolve(query: string): Promise<Track | null>;
}
//# sourceMappingURL=youtube.d.ts.map