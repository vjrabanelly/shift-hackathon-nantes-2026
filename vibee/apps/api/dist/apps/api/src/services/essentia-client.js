"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.essentiaClient = void 0;
const ESSENTIA_URL = process.env.ESSENTIA_URL ?? 'http://localhost:8000';
async function analyzeOnce(options) {
    const body = {
        file_path: options.filePath,
        duration_seconds: 60,
        title: options.title,
        artist: options.artist,
        youtube_id: options.youtubeId,
    };
    const res = await fetch(`${ESSENTIA_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const errBody = await res.json();
            detail = errBody.detail ?? detail;
        }
        catch {
            // ignore parse error
        }
        throw new Error(`Essentia analysis failed: ${detail}`);
    }
    return res.json();
}
exports.essentiaClient = {
    /**
     * Analyze an audio file and return Essentia features.
     * Retries once on network error (e.g., container still starting up).
     * Does NOT retry on 4xx/5xx responses.
     */
    async analyze(options) {
        try {
            return await analyzeOnce(options);
        }
        catch (err) {
            // Only retry on network-level errors (fetch throws), not HTTP errors
            if (err instanceof TypeError && err.message.includes('fetch')) {
                // Wait 2 seconds and retry once
                await new Promise((resolve) => setTimeout(resolve, 2000));
                return analyzeOnce(options);
            }
            throw err;
        }
    },
};
//# sourceMappingURL=essentia-client.js.map