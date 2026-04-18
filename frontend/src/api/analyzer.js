/**
 * analyzer.js — Local FastAPI bpm-detector wrapper
 */

function getBackendUrl() {
  return localStorage.getItem('backend_url') || 'http://localhost:8000';
}

/**
 * Analyze audio from a URL using the local bpm-detector backend.
 * @param {string} url  YouTube, SoundCloud, Bandcamp URL
 * @param {boolean} comprehensive  Run full analysis (slower) or BPM+key only
 */
export async function analyzeTrack(url, comprehensive = true) {
  const base = getBackendUrl();
  const resp = await fetch(`${base}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, comprehensive }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Backend error ${resp.status}`);
  }

  return resp.json();
}

/**
 * Check if backend is online.
 */
export async function checkBackendHealth() {
  try {
    const base = getBackendUrl();
    const resp = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Extract video/track title from a URL using the backend's yt-dlp.
 * @param {string} url
 * @returns {Promise<string>} The extracted title
 */
export async function getUrlTitle(url) {
  const base = getBackendUrl();
  const resp = await fetch(`${base}/title`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to extract title`);
  }

  const data = await resp.json();
  return data.title;
}
