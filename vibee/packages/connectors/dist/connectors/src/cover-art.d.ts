import type { CoverArtConnector, Track } from './types';
/**
 * iTunes Search API cover art connector.
 * Searches for the track on iTunes and returns high-res artwork URL.
 * No API key required.
 */
export declare class ItunesCoverArtConnector implements CoverArtConnector {
    name: string;
    resolve(track: Track): Promise<string | null>;
}
/**
 * YouTube thumbnail connector.
 * Always returns a URL if youtube_id is set. No network request needed.
 * This is the final fallback in the waterfall.
 */
export declare class YouTubeThumbnailConnector implements CoverArtConnector {
    name: string;
    resolve(track: Track): Promise<string | null>;
}
//# sourceMappingURL=cover-art.d.ts.map