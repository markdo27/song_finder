/**
 * spotify.js — Spotify API wrapper
 *
 * In production (Vercel): calls /api/spotify/* → Python serverless functions.
 * In development: Vite proxies /api/* → http://localhost:8000/* (strips /api prefix).
 */

const BASE_URL = () => '/api';

function getSpotifyCreds() {
  return {
    client_id: localStorage.getItem('spotify_client_id') || '',
    client_secret: localStorage.getItem('spotify_client_secret') || '',
  };
}

async function request(path, options = {}) {
  const { client_id, client_secret } = getSpotifyCreds();
  if (!client_id || !client_secret) {
    throw new Error('Spotify not configured. Add your Client ID and Client Secret in Settings.');
  }

  const base = BASE_URL();
  const resp = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body
      ? options.body
      : JSON.stringify({ client_id, client_secret }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${resp.status}`);
  }

  return resp.json();
}

async function configuredRequest(path, options = {}) {
  const base = BASE_URL();
  const resp = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${resp.status}`);
  }

  return resp.json();
}

/**
 * Configure Spotify credentials on the backend.
 */
export async function configureSpotify(client_id, client_secret) {
  const base = BASE_URL();
  const resp = await fetch(`${base}/spotify/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id, client_secret }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Configure failed: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Search tracks on Spotify by text query.
 */
export async function searchTracks(query, limit = 10) {
  const data = await request('/spotify/search', {
    method: 'POST',
    body: JSON.stringify({ query, limit }),
  });
  return data.data || [];
}

/**
 * Get a single track by Spotify ID.
 */
export async function getTrack(trackId) {
  const data = await request(`/spotify/track/${trackId}`, {
    method: 'POST',
    body: JSON.stringify({ track_id: trackId }),
  });
  return data.data;
}

/**
 * Lookup a Spotify URL (track, album) and return track info.
 * Only handles track URLs for now.
 */
export async function lookupByUrl(url) {
  const data = await request('/spotify/lookup-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  return data.data || [];
}

/**
 * Find similar tracks for a given Spotify track ID.
 * Returns { source_track, similar_tracks } where similar tracks have a score (0-1).
 */
export async function getSimilarTracks(trackId, limit = 20) {
  const data = await request('/spotify/similar', {
    method: 'POST',
    body: JSON.stringify({ track_id: trackId, limit }),
  });
  return {
    source: data.data?.source_track || null,
    similar: data.data?.similar_tracks || [],
  };
}

/**
 * Get audio features for multiple tracks.
 */
export async function getAudioFeatures(trackIds) {
  const data = await configuredRequest('/spotify/audio-features', {
    method: 'POST',
    body: JSON.stringify(trackIds),
  });
  return data.data || {};
}

/**
 * Check if Spotify credentials are configured locally.
 */
export function hasCredentials() {
  const { client_id, client_secret } = getSpotifyCreds();
  return !!(client_id && client_secret);
}

/**
 * Convert internal score (0-1) to percentage string.
 */
export function scoreToPercent(score) {
  return Math.round((score || 0) * 100);
}

/**
 * Detect if a URL is a Spotify URL.
 */
export function isSpotifyUrl(url = '') {
  return url.includes('open.spotify.com') || url.startsWith('spotify:track:');
}

/**
 * Get the Spotify embed URL for a track.
 */
export function getEmbedUrl(trackId) {
  return `https://open.spotify.com/embed/track/${trackId}`;
}
