export interface TunebatMetrics {
    bpm: number;
    key: string;
    camelot: string;
    duration: number;
    energy: number;
    danceability: number;
    happiness: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    speechiness: number;
    valence: number;
    mood: string;
    tunebat_url: string;
}
export declare function analyzeTrack(title: string, artist: string): Promise<TunebatMetrics>;
//# sourceMappingURL=tunebat.d.ts.map