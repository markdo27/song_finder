import React from 'react';
import SimilarityBadge from './SimilarityBadge';

const EMOJI_MAP = {
  Discogs: '💿',
  Bandcamp: '🎸',
  Nina: '🎵',
};

export default function TrackCard({
  track,
  isSource = false,
  isActive = false,
  isAnalyzing = false,
  analysisResult = null,
  animationDelay = 0,
  onPlay,
  onAnalyze,
  onAddToPlaylist,
}) {
  const emoji = EMOJI_MAP[track.source] || '🎵';
  const hasVideo = !!track.video_uri;

  return (
    <div
      id={`track-card-${track.id}`}
      className={`track-card${isActive ? ' active' : ''}${isAnalyzing ? ' analyzing' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="card-top">
        <div className="card-art">{emoji}</div>
        <div className="card-info">
          <div className="card-track-name" title={track.track}>{track.track}</div>
          <div className="card-artist" title={track.artist}>{track.artist}</div>
        </div>
        {!isSource && track.score != null && (
          <SimilarityBadge score={track.score} />
        )}
        {isSource && (
          <span className="card-source-badge" style={{ color: 'var(--accent-secondary)', borderColor: 'rgba(6,182,212,0.3)' }}>
            SOURCE
          </span>
        )}
      </div>

      {track.source && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="card-source-badge">{track.source}</span>
          {track.external_link && (
            <a
              href={track.external_link}
              target="_blank"
              rel="noopener noreferrer"
              className="card-source-badge"
              style={{ textDecoration: 'none', color: 'var(--text-muted)' }}
              onClick={e => e.stopPropagation()}
            >
              ↗ View
            </a>
          )}
        </div>
      )}

      {/* Quick analysis summary if already done */}
      {analysisResult && (
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          padding: '6px 0 2px',
          borderTop: '1px solid var(--border)',
          marginTop: 4,
        }}>
          {analysisResult.bpm && (
            <span className="instrument-tag" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
              ♩ {Math.round(analysisResult.bpm)} BPM
            </span>
          )}
          {analysisResult.key && (
            <span className="chord-pill" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
              🎹 {analysisResult.key}
            </span>
          )}
          {analysisResult.time_signature && (
            <span className="card-source-badge">
              {analysisResult.time_signature}
            </span>
          )}
        </div>
      )}

      <div className="card-actions">
        {hasVideo && (
          <button
            className="card-btn play"
            onClick={e => { e.stopPropagation(); onPlay?.(track); }}
            title="Play preview"
          >
            ▶ Play
          </button>
        )}
        <button
          className="card-btn analyze"
          onClick={e => { e.stopPropagation(); onAnalyze?.(track); }}
          disabled={isAnalyzing}
          title="Deep audio analysis (BPM, Key, Chords…)"
        >
          {isAnalyzing ? '⏳ Analyzing…' : '⚡ Analyze'}
        </button>
        <button
          className="card-btn add-playlist"
          onClick={e => { e.stopPropagation(); onAddToPlaylist?.(track); }}
          title="Add to current playlist"
        >
          + Save
        </button>
      </div>
    </div>
  );
}
