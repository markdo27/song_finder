"""POST /api/spotify/lookup_url (rewritten from lookup-url)"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _spotify_lib import get_token, spotify_get, parse_track
from http.server import BaseHTTPRequestHandler
import json, re

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def _parse_spotify_url(url: str):
    if not url:
        return None
    if url.startswith("spotify:track:"):
        return url.split(":")[-1] or None
    m = re.search(r"/track/([A-Za-z0-9]{22})", url)
    return m.group(1) if m else None


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS.items(): self.send_header(k, v)
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        cid = body.get("client_id", "").strip()
        csec = body.get("client_secret", "").strip()
        url = body.get("url", "").strip()
        if not cid or not csec: return self._err(400, "Spotify credentials required")
        if not url: return self._err(400, "url is required")
        track_id = _parse_spotify_url(url)
        if not track_id: return self._err(400, "Could not parse Spotify track ID from URL")
        try:
            token = get_token(cid, csec)
            data = spotify_get(token, f"/tracks/{track_id}")
            self._json({"data": [parse_track(data)]})
        except Exception as e:
            self._err(502, str(e))

    def _json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS.items(): self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _err(self, status, msg): self._json({"detail": msg}, status)
    def log_message(self, *args): pass
