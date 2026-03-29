"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeConnector = void 0;
const child_process_1 = require("child_process");
// Inline copy of searchYouTube (same logic as apps/api/src/lib/ytdlp.ts)
// Using inline to avoid cross-package relative imports that may cause TypeScript issues.
async function searchYouTube(query) {
    return new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)('yt-dlp', [`ytsearch1:${query}`, '--get-id', '--no-playlist']);
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', () => { }); // ignore
        proc.on('close', () => resolve(stdout.trim() || null));
        proc.on('error', reject);
    });
}
class YouTubeConnector {
    name = 'youtube';
    async resolve(query) {
        try {
            const youtubeId = await searchYouTube(query);
            if (!youtubeId)
                return null;
            return {
                title: query, // Placeholder — enriched later by MusicBrainz
                artist: '', // Unknown until metadata enrichment
                youtube_id: youtubeId,
                source: 'youtube',
            };
        }
        catch {
            // yt-dlp not available, network error, etc.
            return null;
        }
    }
}
exports.YouTubeConnector = YouTubeConnector;
//# sourceMappingURL=youtube.js.map