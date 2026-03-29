import re
from typing import Optional
from urllib.parse import quote_plus

from playwright.async_api import async_playwright

TUNEBAT_SEARCH_URL = "https://api.tunebat.com/api/tracks/search?term={}"
TUNEBAT_SIMILAR_URL = "https://api.tunebat.com/api/tracks?trackId={}"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Patterns to strip from YouTube-style titles
_YOUTUBE_NOISE = re.compile(
    r"\(?"
    r"(official\s+)?(lyric\s+|music\s+|audio\s+|live\s+|acoustic\s+|video\s+)?"
    r"(video|lyrics?|audio|clip|hd|hq|4k|vevo|visualizer|remastered|explicit)"
    r"\)?"
    r"|\[.*?\]"
    r"|\(.*?\)",
    re.IGNORECASE,
)


def _clean_query(title: str, artist: str) -> str:
    """Strip YouTube noise and de-duplicate artist name if already in title."""
    clean_title = _YOUTUBE_NOISE.sub("", title).strip(" -–|")
    if artist and artist.lower() in clean_title.lower():
        return clean_title.strip()
    return f"{clean_title} {artist}".strip() if artist else clean_title.strip()


def _derive_mood(energy: float, happiness: float) -> str:
    if happiness >= 0.6 and energy >= 0.6:
        return "happy"
    if happiness < 0.4 and energy >= 0.6:
        return "aggressive"
    if happiness >= 0.5 and energy < 0.5:
        return "relaxed"
    return "sad"


async def _browser_fetch(url: str) -> dict:
    """Visit tunebat.com to pass Cloudflare, then fetch the API URL via in-page JS."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        context = await browser.new_context(
            user_agent=USER_AGENT,
            locale="en-US",
            viewport={"width": 1280, "height": 800},
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = await context.new_page()

        await page.goto("https://tunebat.com", wait_until="domcontentloaded", timeout=30000)

        result = await page.evaluate(
            """async (apiUrl) => {
                const resp = await fetch(apiUrl, {
                    headers: {
                        "Accept": "application/json, text/plain, */*",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Cache-Control": "no-cache",
                        "Pragma": "no-cache",
                    }
                });
                if (!resp.ok) {
                    return { __error__: resp.status };
                }
                return await resp.json();
            }""",
            url,
        )

        await context.close()
        await browser.close()

    if isinstance(result, dict) and "__error__" in result:
        raise RuntimeError(f"Tunebat API returned status {result['__error__']}")

    return result


async def _search_tunebat(query: str) -> Optional[dict]:
    url = TUNEBAT_SEARCH_URL.format(quote_plus(query))
    print(f"[analyzer] Searching Tunebat: {url}", flush=True)

    try:
        data = await _browser_fetch(url)
    except RuntimeError as e:
        print(f"[analyzer] Tunebat search failed: {e}", flush=True)
        return None

    items = data.get("data", {}).get("items") or []
    if not items:
        print(f"[analyzer] Tunebat returned 0 results for query: {query!r}", flush=True)
        return None

    first = items[0]
    track_name = first.get("n", "")
    artists = first.get("as_") or first.get("as") or []
    artist_str = ", ".join(artists) if isinstance(artists, list) else str(artists)
    track_id = first.get("id", "")
    tunebat_url = f"https://tunebat.com/Info/{track_name.replace(' ', '-')}-{artist_str.replace(' ', '-')}/{track_id}"
    print(f"[analyzer] Tunebat top result: '{track_name}' by {artist_str} → {tunebat_url}", flush=True)

    return first


async def analyze_audio(
    file_path: Optional[str] = None,  # noqa: ARG001
    duration_seconds: int = 60,  # noqa: ARG001
    title: Optional[str] = None,
    artist: Optional[str] = None,
    youtube_id: Optional[str] = None,  # noqa: ARG001
) -> dict:
    if not title and not artist:
        raise ValueError("title and/or artist are required")

    query = _clean_query(title or "", artist or "")
    print(f"[analyzer] Query after cleanup: {query!r} (original title: {title!r}, artist: {artist!r})", flush=True)

    track = await _search_tunebat(query)

    # Retry with just the cleaned title if the full query returned nothing
    if not track and artist and artist.lower() in (title or "").lower():
        fallback = _YOUTUBE_NOISE.sub("", title or "").strip(" -–|")
        print(f"[analyzer] Retrying with title-only query: {fallback!r}", flush=True)
        track = await _search_tunebat(fallback)

    if not track:
        raise RuntimeError(f"No Tunebat result found for '{query}'")

    track_name = track.get("n", "")
    artists = track.get("as_") or track.get("as") or []
    artist_str = "-".join(artists) if isinstance(artists, list) else str(artists)
    track_id = track.get("id", "")
    tunebat_url = f"https://tunebat.com/Info/{track_name.replace(' ', '-')}-{artist_str.replace(' ', '-')}/{track_id}"

    energy = float(track.get("e", 0.0))
    happiness = float(track.get("h", 0.0))
    duration_ms = int(track.get("d", 0))

    return {
        "bpm": float(track.get("b", 0.0)),
        "key": str(track.get("k", "C major")),
        "camelot": str(track.get("c", "")),
        "duration": duration_ms // 1000 if duration_ms > 1000 else duration_ms,
        "energy": energy,
        "danceability": float(track.get("da", 0.0)),
        "happiness": happiness,
        "acousticness": float(track.get("ac", 0.0)),
        "instrumentalness": float(track.get("i", 0.0)),
        "liveness": float(track.get("li", 0.0)),
        "speechiness": float(track.get("s", 0.0)),
        "valence": happiness,
        "mood": _derive_mood(energy, happiness),
        "tunebat_url": tunebat_url,
    }
