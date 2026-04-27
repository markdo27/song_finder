"""POST /api/spotify/similar"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from _spotify_lib import get_token, find_similar_tracks
from http.server import BaseHTTPRequestHandler
import json

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

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
        track_id = body.get("track_id", "").strip()
        limit = int(body.get("limit", 20))
        if not cid or not csec: return self._err(400, "Spotify credentials required")
        if not track_id: return self._err(400, "track_id is required")
        try:
            token = get_token(cid, csec)
            source, similar = find_similar_tracks(token, {"id": track_id}, limit=limit)
            self._json({"data": {"source_track": source, "similar_tracks": similar}})
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
