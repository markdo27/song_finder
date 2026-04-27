/**
 * cosine.js — cosine.club API wrapper
 *
 * In dev:  calls /cosine-api/* → Vite proxies to cosine.club (key from .env.local)
 * In prod: calls /api/cosine/* → Vercel serverless proxy adds the key server-side
 *          (no API key needed in the browser at all)
 */

const IS_PROD = import.meta.env.PROD;
const BASE_URL = IS_PROD ? '/api/cosine' : '/cosine-api';

// In production the key lives in the server-side proxy env var.
// In dev it comes from .env.local VITE_COSINE_API_KEY or localStorage.
export function getApiKey() {
  return (
    localStorage.getItem('cosine_api_key') ||
    import.meta.env.VITE_COSINE_API_KEY ||
    ''
  );
}

export function hasApiKey() {
  // In production the proxy always has the key → always "available"
  return IS_PROD || !!getApiKey();
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'song-finder/1.0',
    ...(options.headers || {}),
  };

  // Dev only: attach key from env/localStorage (proxy doesn't add it)
  if (!IS_PROD) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No API key. Add your cosine.club API key in Settings.');
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `API error ${resp.status}`);
  }

  return resp.json();
}

// ── Track endpoints ──────────────────────────────────────────────────────────

export async function searchTracks(query, limit = 10) {
  const params = new URLSearchParams({ q: query, limit });
  const data = await request(`/search?${params}`);
  return data.data || [];
}

export async function lookupByUrl(url) {
  const params = new URLSearchParams({ url });
  const data = await request(`/tracks/lookup?${params}`);
  return data.data || [];
}

export async function getSimilarTracks(trackId, filters = {}) {
  const params = new URLSearchParams({ limit: 20, ...filters });
  const data = await request(`/tracks/${trackId}/similar?${params}`);
  return {
    source: data.data?.source_track || null,
    similar: data.data?.similar_tracks || [],
    meta: data.meta,
  };
}

export async function getTrack(trackId) {
  const data = await request(`/tracks/${trackId}`);
  return data.data;
}

// ── Playlist endpoints ───────────────────────────────────────────────────────

export async function listPlaylists() {
  const data = await request('/playlists');
  return data.data || [];
}

export async function createPlaylist(name, is_public = false) {
  const data = await request('/playlists', {
    method: 'POST',
    body: JSON.stringify({ name, is_public }),
  });
  return data.data;
}

export async function deletePlaylist(id) {
  await request(`/playlists/${id}`, { method: 'DELETE' });
}

export async function addTrackToPlaylist(playlistId, trackId) {
  const data = await request(`/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ track_id: String(trackId) }),
  });
  return data.data;
}

export async function removeTrackFromPlaylist(playlistId, trackId) {
  await request(`/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' });
}

export async function getPlaylist(id) {
  const data = await request(`/playlists/${id}`);
  return data.data;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function scoreToPercent(score) {
  return Math.round((score || 0) * 100);
}

export function detectUrlSource(url = '') {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('discogs.com')) return 'discogs';
  if (url.includes('bandcamp.com')) return 'bandcamp';
  return 'link';
}
