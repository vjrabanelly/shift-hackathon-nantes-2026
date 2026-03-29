export interface Track {
    title: string;
    artist: string;
    duration?: number;
    youtube_id?: string;
    cover_url?: string;
    essentia_features?: EssentiaFeatures;
    source: string;
}
export interface EssentiaFeatures {
    bpm: number;
    key: string;
    energy: number;
    mood: string;
}
export interface MusicConnector {
    name: string;
    resolve(query: string): Promise<Track | null>;
}
export interface CoverArtConnector {
    name: string;
    resolve(track: Track): Promise<string | null>;
}
//# sourceMappingURL=types.d.ts.map