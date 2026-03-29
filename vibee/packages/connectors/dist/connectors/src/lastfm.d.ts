import type { MusicConnector, Track } from './types';
export declare class LastFmConnector implements MusicConnector {
    name: string;
    private get apiKey();
    resolve(query: string): Promise<Track | null>;
    /**
     * Get similar artists for gap-filling queries.
     * Returns top 5 similar artist names, or empty array on error.
     */
    getSimilarArtists(artist: string): Promise<string[]>;
}
//# sourceMappingURL=lastfm.d.ts.map