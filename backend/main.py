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
