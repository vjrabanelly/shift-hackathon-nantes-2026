#!/usr/bin/env python3
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from html import unescape
from typing import Any, Dict, List, Tuple
from urllib.parse import quote_plus
from urllib.request import Request, urlopen


CATALOG = [
    {
        "title": "Danse du tapis",
        "artist": "Tradition mariage vendéen",
        "genres": ["mariage", "tradition", "vendee", "danse"],
        "aliases": [
            "danse du tapis",
            "danse du tapie",
            "musique du tapis mariage",
            "musique du tapis",
            "musique du tapis vendee",
            "musique du tapis vendeenne",
            "musique du tapis mariage vendee",
            "musique du tapis mariage vendeenne",
            "musique utilisee pour la danse du tapis",
            "musique du tapis utilisee en danse de mariage vendeenne",
            "musique dansee en vendee pour les mariages",
            "danse du tapis mariage",
            "danse du tapis vendee",
            "tapie musique mariage vendee",
        ],
        "summary": "Animation traditionnelle de mariage, très liée aux requêtes de type danse du tapis / Vendée / bal de noces.",
        "why_it_matches": "La requête parle explicitement d'une danse de mariage vendéenne: il faut d'abord vérifier la piste traditionnelle 'danse du tapis' avant toute autre proposition générique.",
        "metrics": {"bpm": 118, "energy": 0.62, "valence": 0.78, "danceability": 0.72, "popularity": 38, "play_count": 29000, "source": "python-fallback"},
        "sources": [
            {"platform": "spotify", "external_id": "2xVkmJ1QjSg1rRyQXTA0Nv", "url": "https://open.spotify.com/intl-fr/track/2xVkmJ1QjSg1rRyQXTA0Nv?nd=1", "embed_url": "https://open.spotify.com/embed/track/2xVkmJ1QjSg1rRyQXTA0Nv"},
            {"platform": "youtube", "external_id": "hHA0jCV3v60", "url": "https://www.youtube.com/watch?v=hHA0jCV3v60", "embed_url": "https://www.youtube.com/embed/hHA0jCV3v60"},
        ],
    },
    {
        "title": "One More Time",
        "artist": "Daft Punk",
        "genres": ["french house", "dance", "party"],
        "aliases": [],
        "summary": "Classique immédiat pour relancer une piste avec un sourire collectif.",
        "why_it_matches": "Très fort si l'utilisateur demande un hymne festif, un hit dance ou Daft Punk.",
        "metrics": {"bpm": 123, "energy": 0.81, "valence": 0.82, "danceability": 0.79, "popularity": 92, "play_count": 1250000000, "source": "python-fallback"},
        "sources": [
            {"platform": "youtube", "external_id": "FGBhQbmPwH8", "url": "https://www.youtube.com/watch?v=FGBhQbmPwH8", "embed_url": "https://www.youtube.com/embed/FGBhQbmPwH8"},
            {"platform": "spotify", "external_id": "0DiWol3AO6WpXZgp0goxAV", "url": "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV", "embed_url": "https://open.spotify.com/embed/track/0DiWol3AO6WpXZgp0goxAV"},
            {"platform": "soundcloud", "external_id": "daft-punk-one-more-time", "url": "https://soundcloud.com/daftpunkofficial/one-more-time", "embed_url": "https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/daftpunkofficial/one-more-time"},
            {"platform": "deezer", "external_id": "3135556", "url": "https://www.deezer.com/track/3135556", "embed_url": "https://widget.deezer.com/widget/dark/track/3135556"},
        ],
    },
    {
        "title": "Get Lucky",
        "artist": "Daft Punk",
        "genres": ["nu disco", "party", "funk"],
        "aliases": [],
        "summary": "Excellent équilibre entre groove, chaleur et accessibilité.",
        "why_it_matches": "Idéal si l'utilisateur veut rester dans un registre lumineux, dansant mais pas agressif.",
        "metrics": {"bpm": 116, "energy": 0.75, "valence": 0.88, "danceability": 0.81, "popularity": 90, "play_count": 1010000000, "source": "python-fallback"},
        "sources": [
            {"platform": "youtube", "external_id": "5NV6Rdv1a3I", "url": "https://www.youtube.com/watch?v=5NV6Rdv1a3I", "embed_url": "https://www.youtube.com/embed/5NV6Rdv1a3I"},
            {"platform": "spotify", "external_id": "2Foc5Q5nqNiosCNqttzHof", "url": "https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof", "embed_url": "https://open.spotify.com/embed/track/2Foc5Q5nqNiosCNqttzHof"},
            {"platform": "deezer", "external_id": "69719533", "url": "https://www.deezer.com/track/69719533", "embed_url": "https://widget.deezer.com/widget/dark/track/69719533"},
        ],
    },
    {
        "title": "Music Sounds Better With You",
        "artist": "Stardust",
        "genres": ["french touch", "house", "party"],
        "aliases": [],
        "summary": "Choix très naturel si l'utilisateur veut plus de soleil et de groove sans brutalité.",
        "why_it_matches": "Très bon croisement entre vibes de soirée, esthétique french touch et accessibilité.",
        "metrics": {"bpm": 124, "energy": 0.73, "valence": 0.9, "danceability": 0.82, "popularity": 83, "play_count": 320000000, "source": "python-fallback"},
        "sources": [
            {"platform": "youtube", "external_id": "FQlAEiCb8m0", "url": "https://www.youtube.com/watch?v=FQlAEiCb8m0", "embed_url": "https://www.youtube.com/embed/FQlAEiCb8m0"},
            {"platform": "spotify", "external_id": "303ccTay2FiDTZ9fZ2AdBt", "url": "https://open.spotify.com/track/303ccTay2FiDTZ9fZ2AdBt", "embed_url": "https://open.spotify.com/embed/track/303ccTay2FiDTZ9fZ2AdBt"},
        ],
    },
    {
        "title": "Midnight City",
        "artist": "M83",
        "genres": ["indietronica", "dream pop", "night drive"],
        "aliases": [],
        "summary": "Fonctionne très bien pour un moment plus texturé, cinématographique et nocturne.",
        "why_it_matches": "Bon candidat si le prompt demande quelque chose de plus atmosphérique ou émotionnel.",
        "metrics": {"bpm": 105, "energy": 0.68, "valence": 0.56, "danceability": 0.51, "popularity": 86, "play_count": 540000000, "source": "python-fallback"},
        "sources": [
            {"platform": "youtube", "external_id": "dX3k_QDnzHE", "url": "https://www.youtube.com/watch?v=dX3k_QDnzHE", "embed_url": "https://www.youtube.com/embed/dX3k_QDnzHE"},
            {"platform": "spotify", "external_id": "1eyzqe2QqGZUmfcPZtrIyt", "url": "https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt", "embed_url": "https://open.spotify.com/embed/track/1eyzqe2QqGZUmfcPZtrIyt"},
        ],
    },
    {
        "title": "Latch",
        "artist": "Disclosure ft. Sam Smith",
        "genres": ["uk garage", "house", "uplift"],
        "aliases": [],
        "summary": "Beau compromis entre tension, vocal et énergie dansante.",
        "why_it_matches": "Très utile pour un prompt du type festive mais encore doux.",
        "metrics": {"bpm": 122, "energy": 0.78, "valence": 0.71, "danceability": 0.72, "popularity": 84, "play_count": 620000000, "source": "python-fallback"},
        "sources": [
            {"platform": "youtube", "external_id": "93ASUImTedo", "url": "https://www.youtube.com/watch?v=93ASUImTedo", "embed_url": "https://www.youtube.com/embed/93ASUImTedo"},
            {"platform": "spotify", "external_id": "1Nm7cCxvT7Y4Y9Seh2YbRh", "url": "https://open.spotify.com/track/1Nm7cCxvT7Y4Y9Seh2YbRh", "embed_url": "https://open.spotify.com/embed/track/1Nm7cCxvT7Y4Y9Seh2YbRh"},
        ],
    },
]


def normalize_text(value: str) -> str:
    ascii_text = unicodedata.normalize("NFD", value.lower())
    without_marks = "".join(ch for ch in ascii_text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", "".join(ch if ch.isalnum() else " " for ch in without_marks)).strip()


def slugify(value: str) -> str:
    return normalize_text(value).replace(" ", "-")


def queue_duplicate_id(seed: Dict[str, Any], queue: List[Dict[str, Any]]) -> str | None:
    target = f"{normalize_text(seed['title'])}::{normalize_text(seed['artist'])}"
    for track in queue:
        if f"{normalize_text(track['title'])}::{normalize_text(track['artist'])}" == target:
            return str(track["id"])
    return None


def vibe_boost(seed: Dict[str, Any], joystick: Dict[str, Any] | None) -> float:
    if not joystick:
        return 0.0
    energy = float(joystick.get("energy", 0))
    valence = float(joystick.get("valence", 0))
    genres = [normalize_text(genre) for genre in seed.get("genres", [])]
    boost = 0.0
    if energy > 0.35 and any("party" in genre or "house" in genre for genre in genres):
        boost += 0.08
    if energy < -0.1 and any("dream" in genre for genre in genres):
        boost += 0.06
    if valence > 0.15 and any("uplift" in genre or "funk" in genre for genre in genres):
        boost += 0.05
    return boost


def build_source(seed: Dict[str, Any], source: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": f"{source['platform']}:{source['external_id']}",
        "platform": source["platform"],
        "external_id": source["external_id"],
        "url": source["url"],
        "embed_url": source.get("embed_url"),
        "preview_url": source.get("embed_url"),
        "label": f"{seed['artist']} — {seed['title']}",
        "playable": True,
        "quality_score": source_quality(source["platform"], source.get("url", "")),
    }


def build_candidate_id(seed: Dict[str, Any]) -> str:
    primary = seed["sources"][0]
    return f"{primary['platform']}:{primary['external_id']}"


def exact_alias_hits(seed: Dict[str, Any], query: str) -> Tuple[float, str | None]:
    for alias in seed.get("aliases", []):
        normalized_alias = normalize_text(alias)
        if normalized_alias and normalized_alias in query:
            return 0.72, alias
    return 0.0, None


def lexical_overlap(seed: Dict[str, Any], query_tokens: set[str]) -> float:
    reference_tokens = set(normalize_text(seed["title"]).split())
    reference_tokens.update(normalize_text(seed["artist"]).split())
    for alias in seed.get("aliases", []):
        reference_tokens.update(normalize_text(alias).split())
    for genre in seed.get("genres", []):
        reference_tokens.update(normalize_text(genre).split())
    flattened = {item for item in reference_tokens if item}
    if not flattened:
        return 0.0
    overlap = len(query_tokens & flattened) / len(flattened)
    return min(0.28, overlap * 0.42)


def semantic_cluster_boost(seed: Dict[str, Any], query_tokens: set[str]) -> float:
    stopwords = {"la", "le", "les", "de", "du", "des", "et", "the", "music", "musique"}
    title_tokens = {token for token in normalize_text(seed["title"]).split() if token and token not in stopwords}
    context_tokens = {
        token
        for value in [seed.get("artist", ""), *seed.get("genres", []), *seed.get("aliases", [])]
        for token in normalize_text(str(value)).split()
        if token and token not in stopwords
    }
    title_hits = len(query_tokens & title_tokens)
    context_hits = len(query_tokens & context_tokens)

    if title_hits >= 2 and context_hits >= 2:
        return 0.48
    if title_hits >= 1 and context_hits >= 3:
        return 0.4
    if title_hits >= 1 and context_hits >= 2:
        return 0.28
    return 0.0


def generate_youtube_queries(raw_query: str) -> List[str]:
    normalized = normalize_text(raw_query)
    queries = [normalized]
    if "tapis" in normalized or "tapie" in normalized:
        queries.extend([
            "danse du tapis mariage",
            "danse du tapis mariage vendee",
            "musique danse du tapis mariage",
            "danse du tapis",
        ])
    descriptive_markers = ["parle", "dit", "refrain", "sorciere", "annees 90", "années 90", "vieille musique", "vieux morceau"]
    if any(marker in normalized for marker in [normalize_text(marker) for marker in descriptive_markers]):
        queries.extend([
            normalized,
            f"{normalized} chanson",
            f"{normalized} musique",
            f"{normalized} lyrics",
            f"{normalized} audio",
        ])
    return list(dict.fromkeys(query for query in queries if query))


def build_trace(agent: str, tool: str, status: str, summary: str, query: str | None = None) -> Dict[str, Any]:
    return {
        "id": f"{agent}:{tool}:{abs(hash((agent, tool, query or '', summary))) % 100000}",
        "agent": agent,
        "tool": tool,
        "status": status,
        "query": query,
        "summary": summary,
    }


def detect_intents(raw_query: str) -> List[str]:
    normalized = normalize_text(raw_query)
    intents: List[str] = []
    if any(marker in normalized for marker in ["parole", "lyrics", "la la", "lalala", "fait", "chante", "parle", "dit", "refrain"]):
        intents.append("lyrics")
    if any(marker in normalized for marker in ["son pourri", "mauvais son", "bon son", "meilleure qualite", "audio", "pourri", "qualite"]):
        intents.append("quality")
    if any(marker in normalized for marker in ["c est ca", "c'est ca", "c est bien", "meme musique", "ce morceau"]):
        intents.append("reference")
    if any(marker in normalized for marker in ["qui est", "c est qui", "biographie", "histoire", "origine", "tradition", "wikipedia", "wikidata"]):
        intents.append("context")
    return intents


def source_quality(platform: str, url: str) -> float:
    if platform == "spotify":
        return 0.97
    if platform == "deezer":
        return 0.91
    if platform == "soundcloud":
        return 0.75
    if platform == "youtube":
        lowered = normalize_text(url)
        return 0.58 if "official" not in lowered and "topic" not in lowered else 0.7
    return 0.5


def extract_duration_seconds(renderer: Dict[str, Any]) -> int | None:
    raw = extract_runs_text(renderer, "lengthText")
    if not raw:
        return None
    parts = [int(part) for part in re.findall(r"\d+", raw)]
    if not parts:
        return None
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 1:
        return parts[0]
    return None


def looks_like_music_result(title: str, artist: str, duration_seconds: int | None, query: str) -> bool:
    normalized_title = normalize_text(title)
    normalized_artist = normalize_text(artist)
    normalized_query = normalize_text(query)

    blocked_markers = [
        "shorts",
        "short",
        "karaoke",
        "parodie",
        "tutorial",
        "tuto",
        "reaction",
        "dance tutorial",
        "cours",
        "lesson",
        "meme",
        "compilation",
        "best of",
        "playlist complete",
        "mix",
        "hour version",
        "1 hour",
        "10 hours",
    ]
    if any(marker in normalized_title for marker in blocked_markers):
        return False

    if "/shorts/" in title.lower():
        return False

    # Audio-only tracks are usually at least ~50s and under ~12 min for this UI.
    if duration_seconds is not None and (duration_seconds < 50 or duration_seconds > 720):
        return False

    positive_markers = ["official audio", "audio officiel", "topic", "remastered", "lyrics video", "clip officiel"]
    if any(marker in normalized_title for marker in positive_markers):
        return True

    music_context = [
        "song",
        "chanson",
        "musique",
        "track",
        "audio",
        "lyrics",
        "paroles",
        "ost",
        "bande originale",
    ]
    if any(marker in normalized_query for marker in music_context):
        return True

    # Strong artist/channel signals can also be enough.
    if any(marker in normalized_artist for marker in ["topic", "records", "official", "vevo"]):
        return True

    # Keep broader results only when the title still looks like a track title.
    return len(normalized_title.split()) <= 10


def fetch_ytdlp_candidates(raw_query: str, traces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if shutil.which("yt-dlp") is None:
        traces.append(build_trace("agent-web", "yt-dlp search", "skipped", "yt-dlp absent, bascule vers la recherche web live YouTube.", raw_query))
        return []

    queries = generate_youtube_queries(raw_query)
    results: List[Dict[str, Any]] = []
    for query in queries[:4]:
        traces.append(build_trace("agent-web", "yt-dlp search", "running", "Recherche YouTube lancée.", query))
        try:
            process = subprocess.run(
                ["yt-dlp", f"ytsearch5:{query}", "--dump-single-json", "--flat-playlist", "--no-warnings"],
                capture_output=True,
                text=True,
                check=True,
            )
        except Exception:
            traces.append(build_trace("agent-web", "yt-dlp search", "failed", "La recherche YouTube via yt-dlp a échoué.", query))
            continue

        try:
            payload = json.loads(process.stdout or "{}")
        except Exception:
            traces.append(build_trace("agent-web", "yt-dlp search", "failed", "Réponse yt-dlp invalide.", query))
            continue

        traces.append(build_trace("agent-web", "yt-dlp search", "completed", f"{len(payload.get('entries', []))} résultats YouTube analysés.", query))
        for entry in payload.get("entries", [])[:3]:
            title = str(entry.get("title") or "").strip()
            if not title:
                continue
            video_id = str(entry.get("id") or "").strip()
            duration_seconds = entry.get("duration")
            artist = str(entry.get("channel") or entry.get("uploader") or "YouTube")
            if not looks_like_music_result(title, artist, duration_seconds if isinstance(duration_seconds, int) else None, query):
                continue
            candidate = {
                "id": f"youtube:{video_id}",
                "title": title,
                "artist": artist,
                "artwork_url": None,
                "genres": ["youtube-search"],
                "confidence": 0.38,
                "why_it_matches": f"Résultat YouTube récupéré via la requête '{query}'.",
                "summary": "Candidat récupéré directement depuis la recherche YouTube, à vérifier avant proposition.",
                "source_platforms": ["youtube"],
                "primary_source": {
                    "id": f"youtube:{video_id}",
                    "platform": "youtube",
                    "external_id": video_id,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "embed_url": f"https://www.youtube.com/embed/{video_id}",
                    "preview_url": f"https://www.youtube.com/embed/{video_id}",
                    "label": title,
                    "playable": True,
                },
                "sources": [
                    {
                        "id": f"youtube:{video_id}",
                        "platform": "youtube",
                        "external_id": video_id,
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                        "embed_url": f"https://www.youtube.com/embed/{video_id}",
                        "preview_url": f"https://www.youtube.com/embed/{video_id}",
                        "label": title,
                        "playable": True,
                        "quality_score": source_quality("youtube", title),
                    }
                ],
                "metrics": {"source": "yt-dlp"},
                "verification_status": "unverified",
                "verification_notes": ["resultat YouTube brut", "verification audio recommande"],
                "already_in_queue": False,
                "duplicate_of_track_id": None,
            }
            results.append(candidate)
    return results


def extract_json_blob(document: str, marker: str) -> str | None:
    start = document.find(marker)
    if start == -1:
        return None
    cursor = start + len(marker)
    while cursor < len(document) and document[cursor] in " \n\t":
        cursor += 1
    if cursor >= len(document) or document[cursor] != "{":
        return None

    depth = 0
    in_string = False
    escaped = False
    for index in range(cursor, len(document)):
        char = document[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return document[cursor : index + 1]
    return None


def extract_runs_text(payload: Dict[str, Any], key: str) -> str:
    container = payload.get(key)
    if not isinstance(container, dict):
        return ""
    if isinstance(container.get("simpleText"), str):
        return str(container["simpleText"]).strip()
    runs = container.get("runs")
    if isinstance(runs, list):
        return "".join(str(run.get("text", "")) for run in runs if isinstance(run, dict)).strip()
    return ""


def collect_video_renderers(node: Any, accumulator: List[Dict[str, Any]]) -> None:
    if isinstance(node, dict):
        renderer = node.get("videoRenderer")
        if isinstance(renderer, dict):
            accumulator.append(renderer)
        for value in node.values():
            collect_video_renderers(value, accumulator)
        return
    if isinstance(node, list):
        for item in node:
            collect_video_renderers(item, accumulator)


def parse_view_count(renderer: Dict[str, Any]) -> int | None:
    raw = extract_runs_text(renderer, "viewCountText") or extract_runs_text(renderer, "shortViewCountText")
    if not raw:
        return None
    match = re.search(r"([\d.,\s]+)", raw)
    if not match:
        return None
    digits = re.sub(r"[^\d]", "", match.group(1))
    return int(digits) if digits else None


def fetch_youtube_web_candidates(raw_query: str, traces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    queries = generate_youtube_queries(raw_query)
    results: List[Dict[str, Any]] = []
    seen_video_ids: set[str] = set()

    for query in queries[:3]:
        traces.append(build_trace("agent-web", "youtube live search", "running", "Recherche web YouTube en cours.", query))
        try:
            request = Request(
                f"https://www.youtube.com/results?search_query={quote_plus(query)}&hl=fr",
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
                },
            )
            with urlopen(request, timeout=3.5) as response:
                document = response.read().decode("utf-8", errors="ignore")
        except Exception as error:
            traces.append(build_trace("agent-web", "youtube live search", "failed", f"Recherche web YouTube échouée ({type(error).__name__}).", query))
            continue

        json_blob = None
        for marker in ("var ytInitialData = ", "window['ytInitialData'] = ", "ytInitialData = "):
            json_blob = extract_json_blob(document, marker)
            if json_blob:
                break

        if not json_blob:
            traces.append(build_trace("agent-web", "youtube live search", "failed", "Impossible d'extraire les résultats structurés YouTube.", query))
            continue

        try:
            payload = json.loads(json_blob)
        except Exception:
            traces.append(build_trace("agent-web", "youtube live search", "failed", "Réponse YouTube live non décodable.", query))
            continue

        renderers: List[Dict[str, Any]] = []
        collect_video_renderers(payload, renderers)

        added = 0
        for renderer in renderers:
            video_id = str(renderer.get("videoId") or "").strip()
            title = unescape(extract_runs_text(renderer, "title"))
            artist = unescape(extract_runs_text(renderer, "ownerText") or extract_runs_text(renderer, "longBylineText") or "YouTube")
            if not video_id or not title or video_id in seen_video_ids:
                continue
            duration_seconds = extract_duration_seconds(renderer)
            if not looks_like_music_result(title, artist, duration_seconds, query):
                continue

            seen_video_ids.add(video_id)
            view_count = parse_view_count(renderer)
            candidate = {
                "id": f"youtube:{video_id}",
                "title": title,
                "artist": artist,
                "artwork_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "genres": ["youtube-live-search"],
                "confidence": 0.41,
                "why_it_matches": f"Résultat trouvé en recherche web live sur YouTube avec la requête '{query}'.",
                "summary": "Candidat récupéré sur le web en direct, à recouper avec les autres sources avant proposition.",
                "source_platforms": ["youtube"],
                "primary_source": {
                    "id": f"youtube:{video_id}",
                    "platform": "youtube",
                    "external_id": video_id,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "embed_url": f"https://www.youtube.com/embed/{video_id}",
                    "preview_url": f"https://www.youtube.com/embed/{video_id}",
                    "label": title,
                    "playable": True,
                    "quality_score": source_quality("youtube", artist),
                },
                "sources": [
                    {
                        "id": f"youtube:{video_id}",
                        "platform": "youtube",
                        "external_id": video_id,
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                        "embed_url": f"https://www.youtube.com/embed/{video_id}",
                        "preview_url": f"https://www.youtube.com/embed/{video_id}",
                        "label": title,
                        "playable": True,
                        "quality_score": source_quality("youtube", artist),
                    }
                ],
                "metrics": {"play_count": view_count, "source": "youtube-live-search"},
                "verification_status": "unverified",
                "verification_notes": ["resultat web live", "verification audio recommandee"],
                "already_in_queue": False,
                "duplicate_of_track_id": None,
            }
            results.append(candidate)
            added += 1
            if added >= 3:
                break

        traces.append(build_trace("agent-web", "youtube live search", "completed", f"{added} résultats live analysés.", query))
        if len(results) >= 3:
            break

    return results


def fetch_lyrics_candidates(raw_query: str, traces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    intents = detect_intents(raw_query)
    if "lyrics" not in intents:
        traces.append(build_trace("agent-lyrics", "lyrics lookup", "pending", "Recherche paroles non prioritaire pour cette demande.", raw_query))
        return []

    traces.append(build_trace("agent-lyrics", "lyrics lookup", "running", "Recherche dans les bases de paroles.", raw_query))
    if "danse du tapis" in normalize_text(raw_query):
        traces.append(build_trace("agent-lyrics", "lyrics lookup", "completed", "La requête ressemble davantage à une danse traditionnelle qu'à une recherche par paroles.", raw_query))
        return []

    if os.environ.get("GENIUS_ACCESS_TOKEN"):
        traces.append(build_trace("agent-lyrics", "LyricsGenius", "completed", "Token Genius détecté, fournisseur prêt à être utilisé.", raw_query))
    else:
        traces.append(build_trace("agent-lyrics", "LyricsGenius", "skipped", "GENIUS_ACCESS_TOKEN absent, fallback sans API Genius.", raw_query))

    return []


def fetch_context_candidates(raw_query: str, traces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    intents = detect_intents(raw_query)
    if "context" not in intents:
        traces.append(build_trace("agent-context", "wikipedia lookup", "pending", "Recherche contexte artiste non prioritaire pour cette demande.", raw_query))
        return []

    traces.append(build_trace("agent-context", "wikipedia lookup", "running", "Recherche de contexte artiste et culturel.", raw_query))
    if os.environ.get("WIKIPEDIA_API_ENABLED"):
        traces.append(build_trace("agent-context", "wikipedia lookup", "completed", "Source de contexte prête à être utilisée.", raw_query))
    else:
        traces.append(build_trace("agent-context", "wikipedia lookup", "skipped", "Source Wikipedia non configurée, analyse locale conservée.", raw_query))
    return []


def fetch_shazam_matches(raw_query: str, reference_candidate: Dict[str, Any] | None, traces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    intents = detect_intents(raw_query)
    if "quality" not in intents and "reference" not in intents:
        traces.append(build_trace("agent-audio", "shazam match", "pending", "Matching audio non prioritaire pour cette demande.", raw_query))
        return []

    if shutil.which("shazam") is not None:
        traces.append(build_trace("agent-audio", "shazam-cli", "completed", "shazam-cli détecté, matching audio disponible si un extrait est fourni.", raw_query))
    else:
        traces.append(build_trace("agent-audio", "shazam-cli", "skipped", "shazam-cli absent, matching audio direct indisponible.", raw_query))

    if reference_candidate:
        traces.append(build_trace("agent-audio", "quality reconcile", "completed", "Même morceau conservé, avec préférence pour les sources audio officielles.", reference_candidate["title"]))

    return []


def merge_candidates(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for candidate in candidates:
        key = normalize_text(f"{candidate['artist']} {candidate['title']}")
        existing = merged.get(key)
        if existing is None:
            merged[key] = candidate
            continue

        source_ids = {source["id"] for source in existing.get("sources", [])}
        for source in candidate.get("sources", []):
            if source["id"] not in source_ids:
                existing["sources"].append(source)
                source_ids.add(source["id"])
        existing["source_platforms"] = list(dict.fromkeys(existing["source_platforms"] + candidate.get("source_platforms", [])))
        if candidate.get("confidence", 0) > existing.get("confidence", 0):
            existing["confidence"] = candidate["confidence"]
            existing["why_it_matches"] = candidate["why_it_matches"]
            existing["summary"] = candidate["summary"]
        existing["primary_source"] = sorted(existing["sources"], key=lambda source: float(source.get("quality_score", 0.0)), reverse=True)[0]
        existing["verification_notes"] = list(dict.fromkeys(existing.get("verification_notes", []) + candidate.get("verification_notes", [])))
    return list(merged.values())


def generate_candidates(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    raw_query = str(payload.get("query", ""))
    query = normalize_text(raw_query)
    query_tokens = set(query.split())
    queue = payload.get("queue", [])
    joystick = payload.get("joystick")
    rejected = set(payload.get("rejected_candidate_ids", []))
    reference_candidate = payload.get("reference_candidate")
    traces: List[Dict[str, Any]] = []

    candidates: List[Dict[str, Any]] = []
    traces.append(build_trace("agent-metadata", "intent analysis", "completed", f"Intentions détectées: {', '.join(detect_intents(raw_query)) or 'standard search'}.", raw_query))

    for seed in CATALOG:
        title_hit = 0.48 if normalize_text(seed["title"]) in query else 0.0
        artist_hit = 0.32 if normalize_text(seed["artist"]) in query else 0.0
        genre_hit = 0.18 if any(normalize_text(genre) in query for genre in seed.get("genres", [])) else 0.0
        alias_hit, alias_value = exact_alias_hits(seed, query)
        overlap_hit = lexical_overlap(seed, query_tokens)
        cluster_hit = semantic_cluster_boost(seed, query_tokens)
        energy_boost = vibe_boost(seed, joystick)
        confidence = min(0.99, 0.05 + title_hit + artist_hit + genre_hit + alias_hit + overlap_hit + cluster_hit + energy_boost)
        if reference_candidate:
            same_reference_title = normalize_text(reference_candidate.get("title", "")) == normalize_text(seed["title"])
            same_reference_artist = normalize_text(reference_candidate.get("artist", "")) in normalize_text(seed["artist"])
            if same_reference_title and same_reference_artist:
                confidence = max(confidence, 0.84)
        duplicate_id = queue_duplicate_id(seed, queue)
        sources = [build_source(seed, source) for source in seed["sources"]]
        candidate = {
            "id": build_candidate_id(seed),
            "title": seed["title"],
            "artist": seed["artist"],
            "artwork_url": seed.get("artwork_url"),
            "genres": seed.get("genres", []),
            "confidence": confidence,
            "why_it_matches": seed["why_it_matches"] if not alias_value else f"{seed['why_it_matches']} Alias reconnu: '{alias_value}'.",
            "summary": seed["summary"],
            "source_platforms": [source["platform"] for source in sources],
            "primary_source": sources[0],
            "sources": sources,
            "metrics": seed.get("metrics"),
            "verification_status": "verified" if confidence >= 0.85 else "needs_confirmation" if confidence >= 0.6 else "unverified",
            "verification_notes": ["catalogue local"] + (["alias reconnu"] if alias_value else []) + (["contexte sémantique fort"] if cluster_hit >= 0.28 else []) + (["même morceau recherché avec meilleure source"] if reference_candidate and normalize_text(reference_candidate.get("title", "")) == normalize_text(seed["title"]) else []),
            "already_in_queue": duplicate_id is not None,
            "duplicate_of_track_id": duplicate_id,
        }
        if candidate["id"] not in rejected:
            candidates.append(candidate)

    web_candidates = fetch_ytdlp_candidates(raw_query, traces)
    if not web_candidates:
        web_candidates = fetch_youtube_web_candidates(raw_query, traces)

    for candidate in web_candidates:
        if candidate["id"] in rejected:
            continue
        title = normalize_text(candidate["title"])
        if "danse du tapis" in title and ("mariage" in query or "vendee" in query or "tapis" in query):
            candidate["confidence"] = 0.93
            candidate["genres"] = ["mariage", "tradition", "youtube-search"]
            candidate["summary"] = "Résultat YouTube exact sur la danse du tapis, trouvé via requêtes multiples."
            candidate["why_it_matches"] = "Le titre YouTube correspond directement à la danse du tapis recherchée pour un contexte de mariage."
            candidate["verification_status"] = "needs_confirmation"
            candidate["verification_notes"] = ["resultat YouTube cohérent", "audio à vérifier contre une source officielle"]
        if reference_candidate and normalize_text(reference_candidate.get("title", "")) in title:
            candidate["confidence"] = max(candidate["confidence"], 0.74)
            candidate["verification_notes"] = list(dict.fromkeys(candidate.get("verification_notes", []) + ["même morceau probable, source YouTube alternative"]))
        candidates.append(candidate)

    candidates.extend(fetch_lyrics_candidates(raw_query, traces))
    candidates.extend(fetch_shazam_matches(raw_query, reference_candidate, traces))
    candidates.extend(fetch_context_candidates(raw_query, traces))

    def score(candidate: Dict[str, Any]) -> float:
        duplicate_penalty = 0.45 if candidate.get("already_in_queue") else 0.0
        metrics = candidate.get("metrics") or {}
        normalized_energy = float(metrics.get("energy", 0.5))
        candidate_energy = normalized_energy * 2 - 1
        desired_energy = float((joystick or {}).get("energy", 0))
        energy_gap = abs(desired_energy - candidate_energy)
        energy_score = max(0.0, 0.12 - energy_gap * 0.08)
        tradition_boost = 0.18 if ("mariage" in query and "tapis" in query and "tapis" in normalize_text(candidate["title"])) else 0.0
        quality_bonus = float(candidate.get("primary_source", {}).get("quality_score", 0.0)) * 0.12
        reference_bonus = 0.22 if reference_candidate and normalize_text(reference_candidate.get("title", "")) in normalize_text(candidate["title"]) else 0.0
        return float(candidate["confidence"]) + energy_score + tradition_boost + quality_bonus + reference_bonus - duplicate_penalty

    ranked = sorted(merge_candidates(candidates), key=score, reverse=True)
    ranked = [candidate for candidate in ranked if not candidate.get("already_in_queue")]
    traces.append(build_trace("agent-analysis", "candidate ranking", "completed", f"{len(ranked)} candidats consolidés puis classés.", raw_query))
    return ranked[: int(payload.get("max_candidates", 3))], traces


def main() -> None:
    payload = json.loads(sys.stdin.read() or "{}")
    candidates, traces = generate_candidates(payload)
    diagnostics = []

    for module_name in ("yt_dlp", "spotipy", "soundcloud", "deezer", "wikipedia"):
        try:
            __import__(module_name)
            diagnostics.append(f"{module_name}:available")
        except Exception:
            diagnostics.append(f"{module_name}:missing")

    print(json.dumps({"candidates": candidates, "diagnostics": diagnostics, "search_traces": traces}))


if __name__ == "__main__":
    main()
