import React, { useState, useCallback, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import TrackCard from './components/TrackCard';
import AnalysisPanel from './components/AnalysisPanel';
import Player from './components/Player';
import PlaylistBuilder from './components/PlaylistBuilder';
import SettingsModal from './components/SettingsModal';
import { searchTracks, lookupByUrl, getSimilarTracks, getTrack } from './api/cosine';
import { analyzeTrack, checkBackendHealth } from './api/analyzer';

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
  const [analysisCache, setAnalysisCache] = useState({}); // trackId → result
  const [analyzingId, setAnalyzingId] = useState(null);

  // Player state
  const [playingTrack, setPlayingTrack] = useState(null);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);

  const apiKeySet = !!(localStorage.getItem('cosine_api_key'));

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth().then(ok => setBackendOnline(ok));
  }, []);

  // Show settings on first launch if no API key
  useEffect(() => {
    if (!apiKeySet) setShowSettings(true);
  }, []);

  // --- Search by text query ---
  const handleSearch = useCallback(async (queryOrId, isDirectId = false) => {
    setError(null);
    setLoading(true);
    setSourceTrack(null);
    setSimilarTracks([]);

    try {
      let trackId;
      if (isDirectId) {
        trackId = queryOrId;
      } else {
        const results = await searchTracks(queryOrId, 1);
        if (!results.length) throw new Error(`No track found for "${queryOrId}"`);
        trackId = results[0].id;
      }

      const { source, similar } = await getSimilarTracks(trackId);
      setSourceTrack(source);
      setSimilarTracks(similar);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Lookup by URL (YouTube, SoundCloud, etc.) ---
  const handleLookup = useCallback(async (url) => {
    setError(null);
    setLoading(true);
    setSourceTrack(null);
    setSimilarTracks([]);

    try {
      const tracks = await lookupByUrl(url);
      if (!tracks.length) throw new Error('No tracks found for that URL. The track may not be in the cosine.club database yet.');

      // Use first matched track as source, then fetch similar
      const first = tracks[0];
      const { source, similar } = await getSimilarTracks(first.id);
      setSourceTrack(source || first);
      setSimilarTracks(similar);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Analyze track (bpm-detector) ---
  const handleAnalyze = useCallback(async (track) => {
    // Check cache first
    if (analysisCache[track.id]) {
      setAnalysisTrack(track);
      setAnalysisResult(analysisCache[track.id]);
      setAnalysisError(null);
      return;
    }

    if (!track.video_uri) {
      setAnalysisTrack(track);
      setAnalysisResult(null);
      setAnalysisError('No audio URL available for this track to analyze.');
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
          ? 'Analyzer backend is offline. Run "npm run dev" to start it.'
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
      alert('Playlists require a cosine.club API key. Add one in Settings.');
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
        {/* Search */}
        <SearchBar
          onSearch={handleSearch}
          onLookup={handleLookup}
          loading={loading}
        />

        {/* API key prompt */}
        {!apiKeySet && !showSettings && (
          <div className="error-banner" style={{ margin: '0 0 var(--space-lg)', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', color: 'var(--text-accent)' }}>
            🔑 Add your cosine.club API key in{' '}
            <button
              style={{ color: 'var(--accent-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'inherit' }}
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>{' '}
            to start finding similar tracks.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-banner" style={{ marginBottom: 'var(--space-lg)' }}>
            ⚠ {error}
            <button style={{ marginLeft: 'auto', fontSize: '0.9rem', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && <SkeletonGrid />}

        {/* Results */}
        {!loading && sourceTrack && (
          <>
            {/* Source track banner */}
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

            {/* Similar tracks grid */}
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
              Paste a YouTube, SoundCloud, Bandcamp, or Spotify URL — or type an artist + track name.
              We'll find similar-sounding tracks using ML-powered audio analysis,
              and show you BPM, key, chords, and more.
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
            checkBackendHealth().then(ok => setBackendOnline(ok));
            // Force re-render to pick up new API key state
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
