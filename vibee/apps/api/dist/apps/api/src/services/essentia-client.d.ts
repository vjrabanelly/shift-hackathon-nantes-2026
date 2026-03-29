import type { EssentiaFeatures } from '@partyjam/shared';
interface AnalyzeOptions {
    filePath?: string;
    title?: string;
    artist?: string;
    youtubeId?: string;
}
export declare const essentiaClient: {
    /**
     * Analyze an audio file and return Essentia features.
     * Retries once on network error (e.g., container still starting up).
     * Does NOT retry on 4xx/5xx responses.
     */
    analyze(options: AnalyzeOptions): Promise<EssentiaFeatures>;
};
export {};
//# sourceMappingURL=essentia-client.d.ts.map