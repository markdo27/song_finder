/**
 * cosine.js — cosine.club API wrapper
 *
 * Production (Vercel): calls /api/cosine/* → serverless proxy adds key server-side
 * Local dev:           calls /cosine-api/* → Vite proxies to cosine.club with key from .env.local
 */

const IS_PROD = import.meta.env.PROD;
const BASE_URL = IS_PROD ? '/api/cosine' : '/cosine-api';

// Dev: key from .env.local VITE_COSINE_API_KEY or localStorage
// Prod: key is server-side only; browser doesn't need it
export function getApiKey() {
  return localStorage.getItem('cosine_api_key') || import.meta.env.VITE_COSINE_API_KEY || '';
}

export function hasApiKey() {
  // In prod the proxy always has the key
  return IS_PROD || !!getApiKey();
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  // Dev only: attach key in the Authorization header (Vite proxy forwards it)
  if (!IS_PROD) {
    const key = getApiKey();
    if (!key) throw new Error('No API key — open Settings and add your cosine.club key.');
    headers['Authorization'] = `Bearer ${key}`;
  }

  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const e = new Error(err.message || `API error ${resp.status}`);
    e.status = resp.status;
    throw e;
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
