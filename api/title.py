"""POST /api/title — extract title from YouTube/SoundCloud URL via yt-dlp"""
from http.server import BaseHTTPRequestHandler
import json
import subprocess
import sys


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        url = body.get("url", "").strip()

        if not url:
            return self._err(400, "url is required")

        try:
            result = subprocess.run(
                [sys.executable, "-m", "yt_dlp",
                 "--skip-download", "--no-playlist",
                 "--dump-json", "--quiet", "--no-warnings", url],
                capture_output=True, text=True, timeout=25,
            )
            if result.returncode != 0 or not result.stdout.strip():
                return self._err(422, "Could not extract title from URL")

            info = json.loads(result.stdout)
            artist = info.get("artist") or info.get("uploader") or info.get("channel") or ""
            track = info.get("track") or info.get("title") or ""
            if not track:
                return self._err(422, "Could not extract title")

            title = f"{artist} - {track}" if artist else track
            self._json({"title": title})
        except subprocess.TimeoutExpired:
            self._err(504, "Title extraction timed out")
        except json.JSONDecodeError:
            self._err(500, "Failed to parse yt-dlp output")
        except Exception as e:
            self._err(500, str(e))

    def _json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _err(self, status, msg):
        self._json({"detail": msg}, status)

    def log_message(self, *args):
        pass
