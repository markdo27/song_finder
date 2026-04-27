/**
 * cosine.js — cosine.club API wrapper
 * Calls https://cosine.club/api/v1 directly.
 * API key is baked in at build time via VITE_COSINE_API_KEY.
 * In local dev Vite also proxies /cosine-api as a fallback.
 */

const BASE_URL = 'https://cosine.club/api/v1';
const BAKED_KEY = import.meta.env.VITE_COSINE_API_KEY || '';

export function getApiKey() {
  return localStorage.getItem('cosine_api_key') || BAKED_KEY;
}

export function hasApiKey() {
  return !!getApiKey();
}

async function request(path, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key — open Settings and add your cosine.club key.');

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

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
