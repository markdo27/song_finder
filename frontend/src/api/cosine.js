/**
 * cosine.js — cosine.club API wrapper
 * Docs: https://registry.scalar.com/@cosine/apis/cosineclub-api
 */

const BASE_URL = 'https://cosine.club/api/v1';

function getApiKey() {
  return localStorage.getItem('cosine_api_key') || '';
}

async function request(path, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key set. Please add your cosine.club API key in Settings.');

  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'song-finder/1.0',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `API error ${resp.status}`);
  }

  return resp.json();
}

/**
 * Search tracks by artist / title text query.
 * @param {string} query
 * @param {number} limit
 */
export async function searchTracks(query, limit = 10) {
  const params = new URLSearchParams({ q: query, limit });
  const data = await request(`/search?${params}`);
  return data.data || [];
}

/**
 * Lookup track(s) by URL (YouTube, SoundCloud, Discogs, Bandcamp).
 * @param {string} url
 */
export async function lookupByUrl(url) {
  const params = new URLSearchParams({ url });
  const data = await request(`/tracks/lookup?${params}`);
  return data.data || [];
}

/**
 * Get similar tracks for a given track ID.
 * @param {string} trackId
 * @param {object} filters  { limit, start_year, end_year, min_have, ... }
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
 * @param {string} trackId
 */
export async function getTrack(trackId) {
  const data = await request(`/tracks/${trackId}`);
  return data.data;
}

/**
 * Bulk search: find similar tracks for multiple "Artist - Track" strings.
 * @param {string[]} tracks  e.g. ["Joy Orbison - Hyph Mngo"]
 * @param {number} similar_limit
 */
export async function bulkSearch(tracks, similar_limit = 5) {
  const data = await request('/search/bulk', {
    method: 'POST',
    body: JSON.stringify({ tracks, similar_limit }),
  });
  return data.data?.results || [];
}

// --- Playlist CRUD ---

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
    body: JSON.stringify({ track_id: trackId }),
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

/** Convert cosine score (0-1) to percentage string */
export function scoreToPercent(score) {
  return Math.round((score || 0) * 100);
}

/** Detect URL type for icon display */
export function detectUrlSource(url = '') {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  if (url.includes('bandcamp.com')) return 'bandcamp';
  if (url.includes('open.spotify.com')) return 'spotify';
  if (url.includes('discogs.com')) return 'discogs';
  return 'link';
}
