"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeThumbnailConnector = exports.ItunesCoverArtConnector = void 0;
/**
 * iTunes Search API cover art connector.
 * Searches for the track on iTunes and returns high-res artwork URL.
 * No API key required.
 */
class ItunesCoverArtConnector {
    name = 'itunes';
    async resolve(track) {
        try {
            const query = encodeURIComponent(`${track.title} ${track.artist}`);
            const url = `https://itunes.apple.com/search?term=${query}&media=music&limit=1`;
            const res = await fetch(url);
            if (!res.ok)
                return null;
            const data = await res.json();
            const result = data.results?.[0];
            if (!result?.artworkUrl100)
                return null;
            // Replace 100x100 thumbnail with 600x600 high-res version
            return result.artworkUrl100.replace('100x100', '600x600');
        }
        catch {
            return null;
        }
    }
}
exports.ItunesCoverArtConnector = ItunesCoverArtConnector;
/**
 * YouTube thumbnail connector.
 * Always returns a URL if youtube_id is set. No network request needed.
 * This is the final fallback in the waterfall.
 */
class YouTubeThumbnailConnector {
    name = 'youtube-thumbnail';
    async resolve(track) {
        if (!track.youtube_id)
            return null;
        // mqdefault = medium quality (320x180) — sufficient for cover art
        return `https://img.youtube.com/vi/${track.youtube_id}/mqdefault.jpg`;
    }
}
exports.YouTubeThumbnailConnector = YouTubeThumbnailConnector;
//# sourceMappingURL=cover-art.js.map