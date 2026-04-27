/**
 * cosine.js — cosine.club API wrapper
 * Docs: https://registry.scalar.com/@cosine/apis/cosineclub-api
 *
 * In dev: calls /cosine-api/* → proxied by Vite to https://cosine.club/api/v1
 * In production (Vercel): calls https://cosine.club/api/v1 directly (CORS supported)
 */

const BASE_URL = import.meta.env.PROD
  ? 'https://cosine.club/api/v1'
  : '/cosine-api';

export function getApiKey() {
  return localStorage.getItem('cosine_api_key') || '';
}

export function hasApiKey() {
  return !!getApiKey();
}

async function request(path, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key. Add your cosine.club API key in Settings.');

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'song-finder/1.0',
      ...(options.headers || {}),
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `API error ${resp.status}`);
  }

  return resp.json();
}

// ── Track endpoints ──────────────────────────────────────────────────────────

/**
 * Search tracks by text query.
 * Returns array of track objects: { id, name, artist, track, source, ... }
 */
export async function searchTracks(query, limit = 10) {
  const params = new URLSearchParams({ q: query, limit });
  const data = await request(`/search?${params}`);
  return data.data || [];
}

/**
 * Lookup track(s) by URL (YouTube, Discogs, SoundCloud).
 * Returns array of track objects.
 */
export async function lookupByUrl(url) {
  const params = new URLSearchParams({ url });
  const data = await request(`/tracks/lookup?${params}`);
  return data.data || [];
}

/**
 * Get similar tracks for a given track ID.
 * Returns { source, similar, meta }
 */
export async function getSimilarTracks(trackId, filters = {}) {
  const params = new URLSearchParams({ limit: 20, ...filters });
  const data = await request(`/tracks/${trackId}/similar?${params}`);
  return {
    source: data.data?.source_track || null,
    similar: data.data?.similar_tracks || [],
    meta: data.meta,
  };
}

/**
 * Get track details by ID.
 */
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

/** Convert cosine score (0–1) to integer percentage */
export function scoreToPercent(score) {
  return Math.round((score || 0) * 100);
}

/** Detect source type from URL for icon display */
export function detectUrlSource(url = '') {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('discogs.com')) return 'discogs';
  if (url.includes('bandcamp.com')) return 'bandcamp';
  return 'link';
}
