"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LastFmConnector = void 0;
const LASTFM_BASE = 'http://ws.audioscrobbler.com/2.0';
class LastFmConnector {
    name = 'lastfm';
    get apiKey() {
        return process.env.LASTFM_API_KEY ?? '';
    }
    async resolve(query) {
        if (!this.apiKey)
            return null;
        try {
            const url = new URL(LASTFM_BASE);
            url.searchParams.set('method', 'track.search');
            url.searchParams.set('track', query);
            url.searchParams.set('api_key', this.apiKey);
            url.searchParams.set('format', 'json');
            url.searchParams.set('limit', '1');
            const res = await fetch(url.toString());
            if (!res.ok)
                return null;
            const data = await res.json();
            const track = data.results?.trackmatches?.track?.[0];
            if (!track)
                return null;
            return {
                title: track.name,
                artist: track.artist,
                source: 'lastfm',
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Get similar artists for gap-filling queries.
     * Returns top 5 similar artist names, or empty array on error.
     */
    async getSimilarArtists(artist) {
        if (!this.apiKey)
            return [];
        try {
            const url = new URL(LASTFM_BASE);
            url.searchParams.set('method', 'artist.getSimilar');
            url.searchParams.set('artist', artist);
            url.searchParams.set('api_key', this.apiKey);
            url.searchParams.set('format', 'json');
            url.searchParams.set('limit', '5');
            const res = await fetch(url.toString());
            if (!res.ok)
                return [];
            const data = await res.json();
            const similar = data.similarartists?.artist ?? [];
            return similar.map((a) => a.name).slice(0, 5);
        }
        catch {
            return [];
        }
    }
}
exports.LastFmConnector = LastFmConnector;
//# sourceMappingURL=lastfm.js.map