import React, { useState, useCallback, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import TrackCard from './components/TrackCard';
import AnalysisPanel from './components/AnalysisPanel';
import Player from './components/Player';
import PlaylistBuilder from './components/PlaylistBuilder';
import SettingsModal from './components/SettingsModal';
import {
  searchTracks,
  lookupByUrl,
  getSimilarTracks,
  hasApiKey,
} from './api/cosine';
import { analyzeTrack, checkBackendHealth, getUrlTitle } from './api/analyzer';

// Skeleton Loader
function SkeletonGrid() {
  return (
    <div className="tracks-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="skeleton" style={{ width: '100%', height: 12, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: '70%', height: 10, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: '100%', height: 80 }} />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  // Core state
  const [sourceTrack, setSourceTrack] = useState(null);
  const [similarTracks, setSimilarTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Analysis state
  const [analysisTrack, setAnalysisTrack] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisCache, setAnalysisCache] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);

  // Player state
  const [playingTrack, setPlayingTrack] = useState(null);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);
  const [apiKeySet, setApiKeySet] = useState(hasApiKey());

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth().then(ok => setBackendOnline(ok));
  }, []);

  // Show settings on first launch if no API key
  useEffect(() => {
    if (!hasApiKey()) setShowSettings(true);
  }, []);

  // --- Search by text query ---
  const handleSearch = useCallback(async (query) => {
    setError(null);
    setLoading(true);
    setSourceTrack(null);
    setSimilarTracks([]);

    try {
      // Fetch top 5 candidates — cosine may return 404 for /similar on some tracks
      const results = await searchTracks(query, 5);
      if (!results.length) throw new Error(`No track found for "${query}"`);

      let found = false;
      for (const candidate of results) {
        try {
          const { source, similar } = await getSimilarTracks(candidate.id);
          if (similar.length > 0) {
            setSourceTrack(source || candidate);
            setSimilarTracks(similar);
            found = true;
            break;
          }
        } catch { /* this track has no similar data — try next */ }
      }

      if (!found) throw new Error(`No similar tracks found for "${query}". Try a more specific search.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Lookup by URL (YouTube, Discogs, SoundCloud) ---
  const handleLookup = useCallback(async (url) => {
    setError(null);
    setLoading(true);
    setSourceTrack(null);
    setSimilarTracks([]);

    // Helper: generate progressively simplified search queries from a raw video title.
    // Handles K-pop, J-pop, anime OST titles with Korean/Japanese + English mixed.
    function* generateSearchQueries(raw) {
      const VIDEO_SUFFIX = /[\s[\](（）【】]*\b(official\s*)?(music\s*video|mv|m\/v|live(\s+(version|performance|mv|m\/v))?|lyrics?\s*(video)?|audio|visualizer|teaser|lyric|official(\s+(video|audio|clip))?|performance\s*video|highlight|short\s*ver\.?|full\s*ver\.?)\b[\s[\](（）【】]*/gi;

      // 1. Try the raw title first
      yield raw;

      // 2. Strip video-type suffixes (e.g. "LIVE M/V", "Official Video")
      const stripped = raw.replace(VIDEO_SUFFIX, ' ').replace(/\s{2,}/g, ' ').trim();
      if (stripped && stripped !== raw) yield stripped;

      // 3. Extract English/Latin text from parentheses — best for K-pop/J-pop
      //    "비비 (BIBI) - 책방오빠 (Scott and Zelda)" → ["BIBI", "Scott and Zelda"]
      const latinInParens = [...raw.matchAll(/[(\[（【]([A-Za-z][^)\]）】]{1,60})[)\]）】]/g)]
        .map(m => m[1].trim())
        .filter(Boolean);
      if (latinInParens.length >= 2) {
        yield latinInParens.join(' - ');       // "BIBI - Scott and Zelda"
        yield latinInParens.join(' ');         // "BIBI Scott and Zelda"
      } else if (latinInParens.length === 1) {
        yield latinInParens[0];
      }

      // 4. Keep only Latin/ASCII characters (remove all CJK/non-ASCII)
      const latinOnly = raw
        .replace(/[^\x00-\x7F\s\-()'",]/g, ' ')  // remove non-ASCII
        .replace(VIDEO_SUFFIX, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (latinOnly && latinOnly !== raw && latinOnly.length > 2) yield latinOnly;
    }

    try {
      // ① Clean YouTube URLs — strip playlist/index params that break lookup
      let cleanUrl = url;
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        try {
          const u = new URL(url);
          const v = u.searchParams.get('v');
          cleanUrl = v
            ? `https://www.youtube.com/watch?v=${v}`
            : url.split('&')[0];
        } catch { /* malformed URL — use as-is */ }
      }

      // ② Try cosine.club URL lookup with cleaned URL
      try {
        const tracks = await lookupByUrl(cleanUrl);
        if (tracks.length) {
          const first = tracks[0];
          const { source, similar } = await getSimilarTracks(first.id);
          setSourceTrack(source || first);
          setSimilarTracks(similar);
          return;
        }
      } catch { /* not found in cosine — fall through to title search */ }

      // ③ Extract title via YouTube oEmbed (free, no key, CORS-enabled)
      let rawTitle = null;
      if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
        try {
          const resp = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`
          );
          if (resp.ok) rawTitle = (await resp.json()).title || null;
        } catch { /* oEmbed failed */ }
      }

      // ④ Fallback: local backend yt-dlp (only if running)
      if (!rawTitle && backendOnline) {
        try { rawTitle = await getUrlTitle(cleanUrl); } catch { /* unavailable */ }
      }

      if (!rawTitle) {
        setError('Could not identify this video. Try searching by Artist – Track name instead.');
        return;
      }

      // ⑤ Try multiple cleaned query variants; for each, try up to 3 results
      for (const query of generateSearchQueries(rawTitle)) {
        try {
          const results = await searchTracks(query, 3);
          for (const candidate of results) {
            try {
              const { source, similar } = await getSimilarTracks(candidate.id);
              if (similar.length > 0) {
                setSourceTrack(source || candidate);
                setSimilarTracks(similar);
                return;
              }
            } catch { /* no similar data for this track — try next */ }
          }
        } catch { /* query failed — try next variant */ }
      }

      setError(`No match found for "${rawTitle}". Try searching by Artist – Track name directly.`);
    } catch (e) {
      setError(e.message || 'Something went wrong. Try searching by name.');
    } finally {
      setLoading(false);
    }
  }, [backendOnline]);

  // --- Analyze track (local bpm-detector backend) ---
  const handleAnalyze = useCallback(async (track) => {
    if (analysisCache[track.id]) {
      setAnalysisTrack(track);
      setAnalysisResult(analysisCache[track.id]);
      setAnalysisError(null);
      return;
    }

    if (!track.video_uri) {
      setAnalysisTrack(track);
      setAnalysisResult(null);
      setAnalysisError('No audio URL available for this track.');
      return;
    }

    setAnalysisTrack(track);
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalysisLoading(true);
    setAnalyzingId(track.id);

    try {
      const result = await analyzeTrack(track.video_uri, true);
      setAnalysisResult(result);
      setAnalysisCache(prev => ({ ...prev, [track.id]: result }));
    } catch (e) {
      setAnalysisError(
        backendOnline === false
          ? 'Analyzer backend is offline. Run "python backend/main.py" to start it.'
          : e.message
      );
    } finally {
      setAnalysisLoading(false);
      setAnalyzingId(null);
    }
  }, [analysisCache, backendOnline]);

  // --- Add to playlist ---
  const handleAddToPlaylist = useCallback((track) => {
    if (window.__songFinder_addToPlaylist) {
      window.__songFinder_addToPlaylist(track);
    } else {
      setError('Add your cosine.club API key in Settings to enable playlists.');
    }
  }, []);

  const handleCloseAnalysis = () => {
    setAnalysisTrack(null);
    setAnalysisResult(null);
    setAnalysisError(null);
  };

  return (
    <div className={`app-layout${!apiKeySet ? ' no-sidebar' : ''}`}>
      {/* ── Header ── */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">🎵</div>
          <div className="logo-text">
            Song<span>Finder</span>
          </div>
        </div>

        <div className="header-actions">
          {backendOnline === false && (
            <span
              title="Python analyzer backend is offline — BPM/Key analysis unavailable"
              style={{ fontSize: '0.75rem', color: 'var(--score-mid)', padding: '3px 10px', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-full)', background: 'rgba(245,158,11,0.08)' }}
            >
              ⚠ Analyzer offline
            </span>
          )}
          {backendOnline === true && (
            <span
              style={{ fontSize: '0.75rem', color: 'var(--score-high)', padding: '3px 10px', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-full)', background: 'rgba(34,197,94,0.06)' }}
            >
              ● Analyzer online
            </span>
          )}
          <button
            id="settings-btn"
            className="btn-icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="main-content">
        <SearchBar
          onSearch={handleSearch}
          onLookup={handleLookup}
          loading={loading}
        />

        {/* API key prompt */}
        {!apiKeySet && !showSettings && (
          <div className="error-banner" style={{ margin: '0 0 var(--space-lg)', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', color: 'var(--text-accent)' }}>
            🔑 Add your{' '}
            <a href="https://cosine.club/account/api" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-secondary)' }}>
              cosine.club API key
            </a>
            {' '}in{' '}
            <button
              style={{ color: 'var(--accent-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'inherit' }}
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>
            {' '}to start finding similar tracks.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-banner" style={{ marginBottom: 'var(--space-lg)' }}>
            ⚠ {error}
            <button style={{ marginLeft: 'auto', fontSize: '0.9rem', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Loading */}
        {loading && <SkeletonGrid />}

        {/* Results */}
        {!loading && sourceTrack && (
          <>
            <div className="source-track-banner">
              <div className="source-thumb">🎵</div>
              <div className="source-info">
                <div className="source-name">{sourceTrack.track}</div>
                <div className="source-artist">{sourceTrack.artist}</div>
              </div>
              <div className="source-actions">
                {sourceTrack.video_uri && (
                  <button className="card-btn play" onClick={() => setPlayingTrack(sourceTrack)}>
                    ▶ Play
                  </button>
                )}
                <button className="card-btn analyze" onClick={() => handleAnalyze(sourceTrack)}>
                  ⚡ Analyze
                </button>
              </div>
            </div>

            <div className="section-header">
              <span className="section-title">Similar Tracks</span>
              <span className="section-count">{similarTracks.length} results</span>
            </div>

            <div className="tracks-grid stagger-children">
              {similarTracks.map((track, i) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  isActive={analyzingId === track.id || analysisTrack?.id === track.id}
                  isAnalyzing={analyzingId === track.id}
                  analysisResult={analysisCache[track.id] || null}
                  animationDelay={Math.min(i * 50, 500)}
                  onPlay={() => setPlayingTrack(track)}
                  onAnalyze={() => handleAnalyze(track)}
                  onAddToPlaylist={() => handleAddToPlaylist(track)}
                />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !sourceTrack && !error && (
          <div className="empty-state">
            <div className="empty-icon">🎵</div>
            <div className="empty-title">Find music that sounds like what you love</div>
            <div className="empty-text">
              Paste a YouTube, Discogs, or SoundCloud URL — or type an artist + track name.
              Powered by <strong>cosine.club</strong> vector similarity search.
            </div>
          </div>
        )}
      </main>

      {/* ── Playlist Sidebar ── */}
      {apiKeySet && (
        <PlaylistBuilder
          onTrackPlay={setPlayingTrack}
          apiKeySet={apiKeySet}
        />
      )}

      {/* ── Analysis Panel ── */}
      <AnalysisPanel
        track={analysisTrack}
        result={analysisResult}
        loading={analysisLoading}
        error={analysisError}
        onClose={handleCloseAnalysis}
      />

      {/* ── Player ── */}
      <Player
        track={playingTrack}
        onClose={() => setPlayingTrack(null)}
      />

      {/* ── Settings Modal ── */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSave={() => {
            setApiKeySet(hasApiKey());
            checkBackendHealth().then(ok => setBackendOnline(ok));
          }}
        />
      )}
    </div>
  );
}
