"""
api/cosine/[...path].py
Catch-all proxy: /api/cosine/* → https://cosine.club/api/v1/*
Adds Authorization header server-side so the key never reaches the browser.
Set COSINE_API_KEY in Vercel environment variables.
"""
import os
import json
import requests
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

COSINE_BASE = "https://cosine.club/api/v1"
API_KEY = os.environ.get("COSINE_API_KEY", "")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def _proxy(self, method):
        parsed = urlparse(self.path)

        # Strip /api/cosine prefix → get the cosine.club sub-path
        cosine_path = parsed.path.split("/api/cosine", 1)[-1] or "/"
        url = f"{COSINE_BASE}{cosine_path}"
        if parsed.query:
            url = f"{url}?{parsed.query}"

        req_headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "song-finder/1.0",
        }

        body = None
        if method in ("POST", "PUT"):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else None

        try:
            resp = requests.request(
                method, url, headers=req_headers, data=body, timeout=15
            )
            self.send_response(resp.status_code)
            self.send_header("Content-Type", "application/json")
            for k, v in CORS.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(resp.content)
        except Exception as e:
            body = json.dumps({"message": str(e)}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            for k, v in CORS.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

    def do_GET(self):
        self._proxy("GET")

    def do_POST(self):
        self._proxy("POST")

    def do_DELETE(self):
        self._proxy("DELETE")

    def do_PUT(self):
        self._proxy("PUT")

    def log_message(self, *args):
        pass
