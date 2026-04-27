"""
Spotify API wrapper — handles OAuth, search, recommendations, and audio features.
"""

import os
import base64
import time
import requests
from typing import Optional

SPOTIFY_API_BASE = "https://api.spotify.com/v1"
SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token"

_client_id: Optional[str] = None
_client_secret: Optional[str] = None
_access_token: Optional[str] = None
_token_expires_at: float = 0


def configure(client_id: str, client_secret: str) -> None:
    global _client_id, _client_secret
    _client_id = client_id
    _client_secret = client_secret


def is_configured() -> bool:
    return bool(_client_id and _client_secret)


def _get_token() -> str:
    global _access_token, _token_expires_at

    if _access_token and time.time() < _token_expires_at - 60:
        return _access_token

    if not _client_id or not _client_secret:
        raise RuntimeError("Spotify credentials not configured")

    creds = base64.b64encode(f"{_client_id}:{_client_secret}".encode()).decode()
    resp = requests.post(
        SPOTIFY_AUTH_URL,
        headers={"Authorization": f"Basic {creds}"},
        data={"grant_type": "client_credentials"},
        timeout=15,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Spotify auth failed: {resp.status_code} {resp.text}")

    data = resp.json()
    _access_token = data["access_token"]
    _token_expires_at = time.time() + data.get("expires_in", 3600)
    return _access_token


def _headers() -> dict:
    return {"Authorization": f"Bearer {_get_token()}"}


def _get(url: str, params: Optional[dict] = None) -> dict:
    resp = requests.get(url, headers=_headers(), params=params, timeout=15)
    if resp.status_code == 401:
        global _access_token, _token_expires_at
        _access_token = None
        _token_expires_at = 0
        resp = requests.get(url, headers=_headers(), params=params, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"Spotify API error {resp.status_code}: {resp.text}")
    return resp.json()


def search_track(query: str, limit: int = 10) -> list:
    """
    Search for tracks by text query.
    Returns list of track objects with id, name, artist, album, etc.
    """
    data = _get(
        f"{SPOTIFY_API_BASE}/search",
        params={"q": query, "type": "track", "limit": limit},
    )
    return [_parse_track(t) for t in data.get("tracks", {}).get("items", []) if t.get("id")]


def get_track(track_id: str) -> Optional[dict]:
    """Get a single track by Spotify ID."""
    try:
        return _parse_track(_get(f"{SPOTIFY_API_BASE}/tracks/{track_id}"))
    except RuntimeError:
        return None


def _get_artist_ids(track_id: str) -> list:
    """Return artist IDs for a given track."""
    try:
        data = _get(f"{SPOTIFY_API_BASE}/tracks/{track_id}")
        return [a["id"] for a in data.get("artists", []) if a.get("id")]
    except Exception:
        return []


def _get_related_artist_ids(artist_id: str, max_count: int = 3) -> list:
    """Return IDs of artists related to the given artist."""
    try:
        data = _get(f"{SPOTIFY_API_BASE}/artists/{artist_id}/related-artists")
        return [a["id"] for a in data.get("artists", [])[:max_count] if a.get("id")]
    except Exception:
        return []


def _get_artist_top_tracks(artist_id: str) -> list:
    """Return top tracks for an artist (market=US)."""
    try:
        data = _get(f"{SPOTIFY_API_BASE}/artists/{artist_id}/top-tracks", params={"market": "US"})
        return [_parse_track(t) for t in data.get("tracks", []) if t.get("id")]
    except Exception:
        return []


def get_candidates(seed_track_id: str, limit: int = 20) -> list:
    """
    Build a candidate pool of similar tracks using:
      1. The seed track's own artists' top tracks.
      2. Related artists' top tracks.

    NOTE: Spotify deprecated /v1/recommendations in 2024.
    """
    seen_ids: set = {seed_track_id}
    candidates: list = []

    # Step 1: seed artist(s) top tracks
    artist_ids = _get_artist_ids(seed_track_id)
    for aid in artist_ids:
        for t in _get_artist_top_tracks(aid):
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                candidates.append(t)

    # Step 2: related artists' top tracks
    related_ids: list = []
    for aid in artist_ids[:2]:          # only first 2 seed artists
        related_ids += _get_related_artist_ids(aid, max_count=3)

    for raid in related_ids:
        for t in _get_artist_top_tracks(raid):
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                candidates.append(t)
            if len(candidates) >= limit * 3:   # gather a big pool then slice after scoring
                break
        if len(candidates) >= limit * 3:
            break

    return candidates


def get_audio_features(track_ids: list) -> dict:
    """
    Attempt to get audio features for multiple tracks.
    Returns dict mapping track_id -> features.

    NOTE: This endpoint is blocked for apps created after Nov 27, 2024.
    Returns empty dict gracefully if unavailable (403).
    """
    if not track_ids:
        return {}
    try:
        ids_param = ",".join(track_ids[:100])
        data = _get(f"{SPOTIFY_API_BASE}/audio-features", params={"ids": ids_param})
        features_map = {}
        for f in data.get("audio_features", []):
            if f:
                tid = f.pop("id")
                features_map[tid] = f
        return features_map
    except Exception:
        return {}


def _get_artist_genres(artist_ids: list) -> dict:
    """
    Fetch genres for a list of artist IDs.
    Returns dict mapping artist_id -> set of genre strings.
    Uses /v1/artists?ids= (still available).
    """
    if not artist_ids:
        return {}
    try:
        data = _get(f"{SPOTIFY_API_BASE}/artists", params={"ids": ",".join(artist_ids[:50])})
        return {
            a["id"]: set(a.get("genres", []))
            for a in data.get("artists", [])
            if a and a.get("id")
        }
    except Exception:
        return {}


def compute_similarity(
    source_features: dict,
    candidate_features: dict,
    source_genres: set | None = None,
    candidate_genres: set | None = None,
    candidate_popularity: int = 50,
) -> float:
    """
    Compute 0-1 similarity score.

    Primary signal (genres, always available):
      - Jaccard similarity of genre sets          → weight 0.60

    Secondary signal (audio features, only for old apps):
      - Weighted feature distance                 → weight 0.25

    Tie-breaker:
      - Normalised Spotify popularity             → weight 0.15
    """
    # --- Genre similarity ---
    sg = source_genres or set()
    cg = candidate_genres or set()
    if sg or cg:
        union = sg | cg
        genre_score = len(sg & cg) / len(union) if union else 0.0
    else:
        genre_score = 0.5   # no genre info → neutral

    # --- Audio feature similarity (may be empty for new apps) ---
    if source_features and candidate_features:
        def norm(val, lo, hi):
            return max(0, min(1, (val - lo) / (hi - lo))) if hi > lo else 0.5

        attrs = [
            ("energy", 0, 1, 0.25),
            ("valence", 0, 1, 0.20),
            ("danceability", 0, 1, 0.20),
            ("tempo", 0, 200, 0.20),
            ("loudness", -60, 0, 0.15),
        ]
        feat_score = 0.0
        total_w = 0.0
        for key, lo, hi, w in attrs:
            v1 = source_features.get(key)
            v2 = candidate_features.get(key)
            if v1 is None or v2 is None:
                continue
            diff = abs(norm(v1, lo, hi) - norm(v2, lo, hi))
            feat_score += (1 - diff) * w
            total_w += w
        feat_score = feat_score / total_w if total_w else 0.5
        audio_weight = 0.25
        genre_weight = 0.60
    else:
        feat_score = 0.0
        audio_weight = 0.0
        genre_weight = 0.85   # lean entirely on genres when no audio features

    pop_score = candidate_popularity / 100.0
    pop_weight = 0.15

    return round(
        genre_weight * genre_score + audio_weight * feat_score + pop_weight * pop_score,
        3,
    )


def find_similar_tracks(source_track: dict, limit: int = 20) -> tuple[dict, list]:
    """
    Given a source track, find similar tracks using:
      1. Candidate pool: artist top-tracks + related-artist top-tracks.
      2. Scoring: genre-overlap (Jaccard) + audio features (if available) + popularity.

    Returns (source, ranked_similar_tracks) with a 'score' field (0-1).

    NOTE: /v1/recommendations and /v1/audio-features are blocked for apps
    created after Nov 27, 2024. This implementation works within those limits.
    """
    seed_id = source_track.get("id")
    if not seed_id:
        raise ValueError("Source track has no Spotify ID")

    # Build candidate pool
    candidates = get_candidates(seed_id, limit=limit)
    if not candidates:
        return source_track, []

    # --- Genre lookup ---
    seed_artist_ids = _get_artist_ids(seed_id)
    seed_genre_map = _get_artist_genres(seed_artist_ids)
    source_genres: set = set()
    for genres in seed_genre_map.values():
        source_genres |= genres

    # Collect all candidate artist IDs for a single bulk genre fetch
    all_candidate_artist_ids: list = []
    for t in candidates:
        all_candidate_artist_ids.extend(t.get("artist_ids", []))
    # Deduplicate
    all_candidate_artist_ids = list(dict.fromkeys(all_candidate_artist_ids))
    candidate_genre_map = _get_artist_genres(all_candidate_artist_ids)

    # --- Audio features (graceful 403 handling) ---
    candidate_ids = [c["id"] for c in candidates]
    source_features = get_audio_features([seed_id]).get(seed_id, {})
    all_features = get_audio_features(candidate_ids)

    # --- Score each candidate ---
    scored = []
    for track in candidates:
        cf = all_features.get(track["id"], {})
        # Build this candidate's genre set from its artist IDs
        cand_genres: set = set()
        for aid in track.get("artist_ids", []):
            cand_genres |= candidate_genre_map.get(aid, set())

        score = compute_similarity(
            source_features,
            cf,
            source_genres=source_genres,
            candidate_genres=cand_genres,
            candidate_popularity=track.get("popularity", 50),
        )
        track["score"] = score
        track["audio_features"] = cf
        scored.append(track)

    scored.sort(key=lambda t: t["score"], reverse=True)
    return source_track, scored[:limit]


def _parse_track(t: dict) -> dict:
    """Normalize a Spotify track object to our internal schema."""
    return {
        "id": t.get("id"),
        "track": t.get("name"),
        "artist": ", ".join(a.get("name", "") for a in t.get("artists", [])),
        "artist_ids": [a.get("id") for a in t.get("artists", []) if a.get("id")],
        "album": t.get("album", {}).get("name", ""),
        "album_art": (
            t.get("album", {}).get("images", [{}])[0].get("url", "")
            if t.get("album", {}).get("images")
            else ""
        ),
        "duration_ms": t.get("duration_ms"),
        "popularity": t.get("popularity", 50),
        "external_link": t.get("external_urls", {}).get("spotify", ""),
        "preview_url": t.get("preview_url"),
        "source": "Spotify",
        "video_uri": None,
    }


def parse_spotify_url(url: str) -> Optional[str]:
    """
    Extract track ID from a Spotify URL or URI.
    Handles: https://open.spotify.com/track/xxx, spotify:track:xxx
    """
    if not url:
        return None

    if url.startswith("spotify:track:"):
        return url.split(":")[-1] or None

    for part in url.split("/"):
        if len(part) == 22 and part.replace(
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", ""
        ) == "":
            return part
    return None
