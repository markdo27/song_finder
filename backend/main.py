"""
Song Finder Backend — FastAPI service wrapping bpm-detector
Provides audio analysis: BPM, key, chords, structure, timbre, etc.
"""

import os
import sys
import json
import tempfile
import subprocess
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import spotify_api as spotify

app = FastAPI(title="Song Finder Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str
    comprehensive: bool = True


class AnalyzeResponse(BaseModel):
    success: bool
    bpm: Optional[float] = None
    bpm_confidence: Optional[float] = None
    key: Optional[str] = None
    key_confidence: Optional[float] = None
    duration: Optional[float] = None
    time_signature: Optional[str] = None
    groove_type: Optional[str] = None
    chord_progression: Optional[list] = None
    chord_complexity: Optional[float] = None
    structure_form: Optional[str] = None
    section_count: Optional[int] = None
    sections: Optional[list] = None
    dominant_instruments: Optional[list] = None
    timbral_characteristics: Optional[dict] = None
    energy_level: Optional[str] = None
    dynamic_range: Optional[str] = None
    error: Optional[str] = None


def find_ffmpeg_dir():
    """Find ffmpeg binary directory."""
    import shutil
    ff = shutil.which("ffmpeg")
    if ff:
        return str(Path(ff).parent)
    # Winget default install path
    winget_path = Path.home() / "AppData/Local/Microsoft/WinGet/Packages"
    for d in winget_path.glob("Gyan.FFmpeg*"):
        for b in d.rglob("ffmpeg.exe"):
            return str(b.parent)
    return None


FFMPEG_DIR = find_ffmpeg_dir()


def download_audio(url: str, output_dir: str) -> str:
    """Download audio from URL using yt-dlp. Returns path to downloaded file."""
    output_template = os.path.join(output_dir, "audio.%(ext)s")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--extract-audio",
        "--audio-format", "wav",
        "--audio-quality", "0",
        "--no-playlist",
        "--quiet",
        "-o", output_template,
        url
    ]
    if FFMPEG_DIR:
        cmd.insert(-1, "--ffmpeg-location")
        cmd.insert(-1, FFMPEG_DIR)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")

    # Find the downloaded file
    for f in Path(output_dir).iterdir():
        if f.suffix in (".wav", ".mp3", ".m4a", ".opus", ".webm"):
            return str(f)
    raise RuntimeError("Downloaded audio file not found")


def analyze_audio(audio_path: str, comprehensive: bool = True) -> dict:
    """Run bpm-detector analysis and return structured results."""
    try:
        from bpm_detector import AudioAnalyzer
        analyzer = AudioAnalyzer()
        results = analyzer.analyze_file(
            audio_path,
            detect_key=True,
            comprehensive=comprehensive,
        )
        return results
    except ImportError:
        # Fallback: use CLI subprocess
        cmd = [sys.executable, "-m", "bpm_detector.cli",
               "--detect-key", "--quiet", audio_path]
        if comprehensive:
            cmd.insert(-1, "--comprehensive")
        result = subprocess.run(cmd, capture_output=True, text=True)
        return {"raw_output": result.stdout, "error": result.stderr}


def parse_results(raw: dict) -> dict:
    """Normalize bpm-detector output to our API schema."""
    parsed = {}

    basic = raw.get("basic_info", {})
    parsed["bpm"] = basic.get("bpm")
    parsed["bpm_confidence"] = basic.get("bpm_confidence")
    parsed["key"] = basic.get("key")
    parsed["key_confidence"] = basic.get("key_confidence")
    parsed["duration"] = basic.get("duration")

    rhythm = raw.get("rhythm", {})
    parsed["time_signature"] = rhythm.get("time_signature")
    parsed["groove_type"] = rhythm.get("groove_type")

    chords = raw.get("chord_progression", {})
    parsed["chord_progression"] = chords.get("main_progression", [])
    parsed["chord_complexity"] = chords.get("chord_complexity")

    structure = raw.get("structure", {})
    parsed["structure_form"] = structure.get("form")
    parsed["section_count"] = structure.get("section_count")
    parsed["sections"] = structure.get("sections", [])

    timbre = raw.get("timbre", {})
    parsed["dominant_instruments"] = timbre.get("dominant_instruments", [])
    parsed["timbral_characteristics"] = {
        "brightness": timbre.get("brightness"),
        "warmth": timbre.get("warmth"),
        "roughness": timbre.get("roughness"),
    }

    dynamics = raw.get("dynamics", {})
    parsed["energy_level"] = dynamics.get("energy_level")
    parsed["dynamic_range"] = dynamics.get("dynamic_range")

    return parsed


@app.get("/health")
async def health():
    return {"status": "ok", "service": "song-finder-analyzer"}


class TitleRequest(BaseModel):
    url: str


@app.post("/title")
async def get_title(req: TitleRequest):
    """Extract video/track title from a URL using yt-dlp (no download)."""
    try:
        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--skip-download", "--no-playlist",
            "--dump-json", "--quiet", "--no-warnings",
            req.url
        ]
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        )

        if result.returncode != 0 or not result.stdout.strip():
            raise HTTPException(status_code=422, detail="Could not extract title from URL")

        info = json.loads(result.stdout)
        artist = info.get("artist") or info.get("uploader") or info.get("channel") or ""
        track = info.get("track") or info.get("title") or ""

        if not track:
            raise HTTPException(status_code=422, detail="Could not extract title")

        title = f"{artist} - {track}" if artist else track
        return {"title": title}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse yt-dlp output")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Title extraction timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# Spotify API Endpoints
# ─────────────────────────────────────────────────────────────

class SpotifyConfigRequest(BaseModel):
    client_id: str
    client_secret: str


@app.post("/spotify/configure")
async def configure_spotify(req: SpotifyConfigRequest):
    """Store Spotify OAuth credentials (client ID + secret)."""
    if not req.client_id or not req.client_secret:
        raise HTTPException(status_code=400, detail="client_id and client_secret are required")
    spotify.configure(req.client_id, req.client_secret)
    try:
        spotify._get_token()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Spotify auth failed: {e}")
    return {"status": "ok", "message": "Spotify credentials configured successfully"}


class SpotifySearchRequest(BaseModel):
    query: str
    limit: int = 10


@app.post("/spotify/search")
async def spotify_search(req: SpotifySearchRequest):
    """Search Spotify tracks by text query."""
    if not spotify.is_configured():
        raise HTTPException(status_code=400, detail="Spotify not configured. Add credentials in Settings.")
    try:
        results = spotify.search_track(req.query, limit=req.limit)
        return {"data": results}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/spotify/track/{track_id}")
async def spotify_get_track(track_id: str):
    """Get a single Spotify track by ID."""
    if not spotify.is_configured():
        raise HTTPException(status_code=400, detail="Spotify not configured")
    track = spotify.get_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"data": track}


class SpotifySimilarRequest(BaseModel):
    track_id: str
    limit: int = 20


@app.post("/spotify/similar")
async def spotify_similar(req: SpotifySimilarRequest):
    """
    Find tracks similar to a given Spotify track ID.
    Uses Spotify recommendations + audio feature similarity scoring.
    Returns source track + ranked similar tracks with 0-1 scores.
    """
    if not spotify.is_configured():
        raise HTTPException(status_code=400, detail="Spotify not configured")
    try:
        source, similar = spotify.find_similar_tracks(
            {"id": req.track_id},
            limit=req.limit
        )
        return {"data": {"source_track": source, "similar_tracks": similar}}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class SpotifyUrlLookupRequest(BaseModel):
    url: str


@app.post("/spotify/lookup-url")
async def spotify_lookup_url(req: SpotifyUrlLookupRequest):
    """
    Extract track info from a Spotify URL (track, album, playlist).
    For now, extracts track ID from track URLs.
    """
    if not spotify.is_configured():
        raise HTTPException(status_code=400, detail="Spotify not configured")
    track_id = spotify.parse_spotify_url(req.url)
    if not track_id:
        raise HTTPException(status_code=400, detail="Could not parse Spotify track ID from URL")
    track = spotify.get_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found on Spotify")
    return {"data": [track]}


@app.post("/spotify/audio-features")
async def spotify_audio_features(track_ids: list[str]):
    """Get audio features for a list of Spotify track IDs."""
    if not spotify.is_configured():
        raise HTTPException(status_code=400, detail="Spotify not configured")
    if len(track_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 track IDs per request")
    features = spotify.get_audio_features(track_ids)
    return {"data": features}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """
    Download audio from a URL and run comprehensive music analysis.
    Supports YouTube, SoundCloud, Bandcamp, Spotify (preview), etc.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        try:
            # Step 1: Download audio
            audio_path = await asyncio.get_event_loop().run_in_executor(
                None, download_audio, req.url, tmp_dir
            )
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Failed to download audio: {str(e)}")

        try:
            # Step 2: Analyze
            raw_results = await asyncio.get_event_loop().run_in_executor(
                None, analyze_audio, audio_path, req.comprehensive
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

        try:
            parsed = parse_results(raw_results)
            return AnalyzeResponse(success=True, **parsed)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse results: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
