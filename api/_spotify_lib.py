"""
_spotify_lib.py — Shared Spotify helpers for Vercel serverless functions.
Files starting with _ are ignored as API routes by Vercel but can be imported.
"""
import base64
import requests

SPOTIFY_API_BASE = "https://api.spotify.com/v1"
SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token"


def get_token(client_id: str, client_secret: str) -> str:
    creds = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    resp = requests.post(
        SPOTIFY_AUTH_URL,
        headers={"Authorization": f"Basic {creds}"},
        data={"grant_type": "client_credentials"},
        timeout=10,
    )
    if resp.status_code != 200:
        raise Exception(f"Spotify auth failed: {resp.status_code} {resp.text[:200]}")
    return resp.json()["access_token"]


def spotify_get(token: str, path: str, params=None) -> dict:
    resp = requests.get(
        f"{SPOTIFY_API_BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        params=params,
        timeout=10,
    )
    if not resp.ok:
        raise Exception(f"Spotify API {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def parse_track(t: dict) -> dict:
    return {
        "id": t.get("id"),
        "track": t.get("name"),
        "artist": ", ".join(a.get("name", "") for a in t.get("artists", [])),
        "artist_ids": [a["id"] for a in t.get("artists", []) if a.get("id")],
        "album": t.get("album", {}).get("name", ""),
        "album_art": (
            t.get("album", {}).get("images", [{}])[0].get("url", "")
            if t.get("album", {}).get("images") else ""
        ),
        "duration_ms": t.get("duration_ms"),
        "popularity": t.get("popularity", 50),
        "external_link": t.get("external_urls", {}).get("spotify", ""),
        "preview_url": t.get("preview_url"),
        "source": "Spotify",
        "video_uri": None,
    }


# ── Candidate pool (replaces deprecated /recommendations) ─────────────────────

def _get_artist_ids(token: str, track_id: str) -> list:
    try:
        data = spotify_get(token, f"/tracks/{track_id}")
        return [a["id"] for a in data.get("artists", []) if a.get("id")]
    except Exception:
        return []


def _get_related_artist_ids(token: str, artist_id: str, max_count: int = 3) -> list:
    try:
        data = spotify_get(token, f"/artists/{artist_id}/related-artists")
        return [a["id"] for a in data.get("artists", [])[:max_count] if a.get("id")]
    except Exception:
        return []


def _get_artist_top_tracks(token: str, artist_id: str) -> list:
    try:
        data = spotify_get(token, f"/artists/{artist_id}/top-tracks", {"market": "US"})
        return [parse_track(t) for t in data.get("tracks", []) if t.get("id")]
    except Exception:
        return []


def get_candidates(token: str, seed_track_id: str, limit: int = 20) -> list:
    seen: set = {seed_track_id}
    candidates: list = []

    artist_ids = _get_artist_ids(token, seed_track_id)
    for aid in artist_ids:
        for t in _get_artist_top_tracks(token, aid):
            if t["id"] not in seen:
                seen.add(t["id"])
                candidates.append(t)

    related_ids: list = []
    for aid in artist_ids[:2]:
        related_ids += _get_related_artist_ids(token, aid, max_count=3)

    for raid in related_ids:
        for t in _get_artist_top_tracks(token, raid):
            if t["id"] not in seen:
                seen.add(t["id"])
                candidates.append(t)
        if len(candidates) >= limit * 3:
            break

    return candidates


# ── Scoring ────────────────────────────────────────────────────────────────────

def get_audio_features(token: str, track_ids: list) -> dict:
    """Gracefully returns {} if endpoint is blocked (new Spotify apps after Nov 2024)."""
    if not track_ids:
        return {}
    try:
        data = spotify_get(token, "/audio-features", {"ids": ",".join(track_ids[:100])})
        result = {}
        for f in data.get("audio_features", []):
            if f:
                tid = f.pop("id", None)
                if tid:
                    result[tid] = f
        return result
    except Exception:
        return {}


def get_artist_genres(token: str, artist_ids: list) -> dict:
    if not artist_ids:
        return {}
    try:
        data = spotify_get(token, "/artists", {"ids": ",".join(artist_ids[:50])})
        return {
            a["id"]: set(a.get("genres", []))
            for a in data.get("artists", []) if a and a.get("id")
        }
    except Exception:
        return {}


def compute_similarity(
    source_features: dict,
    candidate_features: dict,
    source_genres: set = None,
    candidate_genres: set = None,
    candidate_popularity: int = 50,
) -> float:
    sg = source_genres or set()
    cg = candidate_genres or set()
    union = sg | cg
    genre_score = len(sg & cg) / len(union) if union else 0.5

    if source_features and candidate_features:
        def norm(v, lo, hi): return max(0, min(1, (v - lo) / (hi - lo))) if hi > lo else 0.5
        attrs = [("energy", 0, 1, .25), ("valence", 0, 1, .20),
                 ("danceability", 0, 1, .20), ("tempo", 0, 200, .20), ("loudness", -60, 0, .15)]
        fs, tw = 0.0, 0.0
        for key, lo, hi, w in attrs:
            v1, v2 = source_features.get(key), candidate_features.get(key)
            if v1 is not None and v2 is not None:
                fs += (1 - abs(norm(v1, lo, hi) - norm(v2, lo, hi))) * w
                tw += w
        feat_score = fs / tw if tw else 0.5
        gw, aw = 0.60, 0.25
    else:
        feat_score, gw, aw = 0.0, 0.85, 0.0

    return round(gw * genre_score + aw * feat_score + 0.15 * (candidate_popularity / 100), 3)


def find_similar_tracks(token: str, source_track: dict, limit: int = 20):
    seed_id = source_track.get("id")
    if not seed_id:
        raise ValueError("Source track has no Spotify ID")

    candidates = get_candidates(token, seed_id, limit=limit)
    if not candidates:
        return source_track, []

    seed_artist_ids = _get_artist_ids(token, seed_id)
    seed_genre_map = get_artist_genres(token, seed_artist_ids)
    source_genres: set = set()
    for gs in seed_genre_map.values():
        source_genres |= gs

    all_candidate_artist_ids = list(dict.fromkeys(
        aid for t in candidates for aid in t.get("artist_ids", [])
    ))
    cand_genre_map = get_artist_genres(token, all_candidate_artist_ids)

    cids = [c["id"] for c in candidates]
    src_features = get_audio_features(token, [seed_id]).get(seed_id, {})
    all_features = get_audio_features(token, cids)

    scored = []
    for track in candidates:
        cg: set = set()
        for aid in track.get("artist_ids", []):
            cg |= cand_genre_map.get(aid, set())
        score = compute_similarity(
            src_features, all_features.get(track["id"], {}),
            source_genres=source_genres, candidate_genres=cg,
            candidate_popularity=track.get("popularity", 50),
        )
        track["score"] = score
        scored.append(track)

    scored.sort(key=lambda t: t["score"], reverse=True)
    return source_track, scored[:limit]
