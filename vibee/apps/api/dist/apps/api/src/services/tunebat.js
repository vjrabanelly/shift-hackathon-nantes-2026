"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTrack = analyzeTrack;
const playwright_1 = require("playwright");
const TUNEBAT_SEARCH_URL = 'https://api.tunebat.com/api/tracks/search?term=';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const YOUTUBE_NOISE = /\(?(official\s+)?(lyric\s+|music\s+|audio\s+|live\s+|acoustic\s+|video\s+)?(video|lyrics?|audio|clip|hd|hq|4k|vevo|visualizer|remastered|explicit)\)?|\[.*?\]|\(.*?\)/gi;
function cleanQuery(title, artist) {
    const cleanTitle = title
        .replace(YOUTUBE_NOISE, '')
        .trim()
        .replace(/^[\s\-–|]+|[\s\-–|]+$/g, '');
    if (artist && cleanTitle.toLowerCase().includes(artist.toLowerCase())) {
        return cleanTitle;
    }
    return artist ? `${cleanTitle} ${artist}`.trim() : cleanTitle;
}
function deriveMood(energy, happiness) {
    if (happiness >= 0.6 && energy >= 0.6)
        return 'happy';
    if (happiness < 0.4 && energy >= 0.6)
        return 'aggressive';
    if (happiness >= 0.5 && energy < 0.5)
        return 'relaxed';
    return 'sad';
}
async function browserFetch(url) {
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
        userAgent: USER_AGENT,
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
    });
    await context.addInitScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");
    const page = await context.newPage();
    try {
        await page.goto('https://tunebat.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const result = await page.evaluate(async (apiUrl) => {
            const resp = await fetch(apiUrl, {
                headers: {
                    Accept: 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache',
                },
            });
            if (!resp.ok)
                return { __error__: resp.status };
            return resp.json();
        }, url);
        if (result && typeof result === 'object' && '__error__' in result) {
            throw new Error(`Tunebat API returned status ${result.__error__}`);
        }
        return result;
    }
    finally {
        await context.close();
        await browser.close();
    }
}
async function searchTunebat(query) {
    const url = TUNEBAT_SEARCH_URL + encodeURIComponent(query);
    console.log(`[tunebat] Searching: ${url}`);
    try {
        const data = await browserFetch(url);
        const items = data?.data?.items ?? [];
        if (!items.length) {
            console.log(`[tunebat] No results for: ${query}`);
            return null;
        }
        return items[0];
    }
    catch (err) {
        console.log(`[tunebat] Search failed: ${String(err)}`);
        return null;
    }
}
async function analyzeTrack(title, artist) {
    if (!title && !artist)
        throw new Error('title and/or artist are required');
    const query = cleanQuery(title ?? '', artist ?? '');
    console.log(`[tunebat] Query: ${query} (title: ${title}, artist: ${artist})`);
    let track = await searchTunebat(query);
    // Retry with cleaned title only if artist was already in the title
    if (!track && artist && (title ?? '').toLowerCase().includes(artist.toLowerCase())) {
        const fallback = (title ?? '')
            .replace(YOUTUBE_NOISE, '')
            .trim()
            .replace(/^[\s\-–|]+|[\s\-–|]+$/g, '');
        console.log(`[tunebat] Retrying with title-only: ${fallback}`);
        track = await searchTunebat(fallback);
    }
    if (!track)
        throw new Error(`No Tunebat result found for '${query}'`);
    const trackName = String(track.n ?? '');
    const rawArtists = track.as_ ?? track.as;
    const artists = Array.isArray(rawArtists) ? rawArtists.map(String) : [];
    const artistStr = artists.join('-');
    const trackId = String(track.id ?? '');
    const tunebat_url = `https://tunebat.com/Info/${trackName.replace(/ /g, '-')}-${artistStr.replace(/ /g, '-')}/${trackId}`;
    const energy = parseFloat(String(track.e ?? 0));
    const happiness = parseFloat(String(track.h ?? 0));
    const durationMs = parseInt(String(track.d ?? 0), 10);
    return {
        bpm: parseFloat(String(track.b ?? 0)),
        key: String(track.k ?? 'C major'),
        camelot: String(track.c ?? ''),
        duration: durationMs > 1000 ? Math.floor(durationMs / 1000) : durationMs,
        energy,
        danceability: parseFloat(String(track.da ?? 0)),
        happiness,
        acousticness: parseFloat(String(track.ac ?? 0)),
        instrumentalness: parseFloat(String(track.i ?? 0)),
        liveness: parseFloat(String(track.li ?? 0)),
        speechiness: parseFloat(String(track.s ?? 0)),
        valence: happiness,
        mood: deriveMood(energy, happiness),
        tunebat_url,
    };
}
//# sourceMappingURL=tunebat.js.map