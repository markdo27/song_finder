import React, { useEffect, useRef } from 'react';

export default function AnalysisPanel({ track, result, loading, error, onClose }) {
  const panelRef = useRef(null);

  const isOpen = !!(track);

  // Trap escape key
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  function ConfidenceBar({ value }) {
    const pct = value != null ? Math.round(value * 100) : null;
    return pct != null ? (
      <div className="metric-confidence">
        <div className="confidence-bar">
          <div className="confidence-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="confidence-pct">{pct}%</span>
      </div>
    ) : null;
  }

  function MetricCard({ label, value, unit, confidence }) {
    return (
      <div className="metric-value-card">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value ?? '—'}</div>
        {unit && <div className="metric-unit">{unit}</div>}
        {confidence != null && <ConfidenceBar value={confidence} />}
      </div>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`analysis-overlay${isOpen ? ' open' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        className={`analysis-panel${isOpen ? ' open' : ''}`}
        role="complementary"
        aria-label="Audio Analysis"
      >
        <div className="analysis-header">
          <div>
            <div className="analysis-title">⚡ Audio Analysis</div>
            {track && (
              <div className="analysis-subtitle" style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {track.artist} — {track.track}
              </div>
            )}
          </div>
          <button className="close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="analysis-body">
          {loading && (
            <div className="analysis-loading">
              <div className="analysis-spinner" />
              <div className="analysis-loading-text">
                Downloading audio + running deep analysis…<br />
                <span style={{ fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                  This takes 15–60s depending on track length
                </span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="error-banner" style={{ marginBottom: 'var(--space-lg)' }}>
              ⚠ {error}
            </div>
          )}

          {result && !loading && (
            <>
              {/* BPM + Key — Hero metrics */}
              <div className="metric-group">
                <div className="metric-group-title">Tempo & Tonality</div>
                <div className="metric-hero">
                  <MetricCard
                    label="BPM"
                    value={result.bpm != null ? Math.round(result.bpm * 10) / 10 : null}
                    unit="beats/min"
                    confidence={result.bpm_confidence}
                  />
                  <MetricCard
                    label="Key"
                    value={result.key}
                    confidence={result.key_confidence}
                  />
                </div>
                <div className="metric-hero">
                  <MetricCard label="Time Sig" value={result.time_signature} />
                  <MetricCard label="Groove" value={result.groove_type} />
                </div>
              </div>

              {/* Chord Progression */}
              {result.chord_progression?.length > 0 && (
                <div className="metric-group">
                  <div className="metric-group-title">Chord Progression</div>
                  <div className="chord-row" style={{ marginBottom: 'var(--space-sm)' }}>
                    {result.chord_progression.map((chord, i) => (
                      <React.Fragment key={i}>
                        <span className="chord-pill">{chord}</span>
                        {i < result.chord_progression.length - 1 && (
                          <span className="chord-arrow">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  {result.chord_complexity != null && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Complexity: {Math.round(result.chord_complexity * 100)}%
                      <div className="confidence-bar" style={{ marginTop: 4 }}>
                        <div className="confidence-fill" style={{ width: `${Math.round(result.chord_complexity * 100)}%`, background: 'var(--accent-hot)' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Song Structure */}
              {(result.structure_form || result.sections?.length > 0) && (
                <div className="metric-group">
                  <div className="metric-group-title">Song Structure</div>
                  {result.structure_form && (
                    <div className="form-label" style={{ marginBottom: 'var(--space-sm)' }}>
                      {result.structure_form}
                    </div>
                  )}
                  {result.sections?.length > 0 && (
                    <div className="section-timeline">
                      {result.sections.map((s, i) => (
                        <span key={i} className="section-chip">
                          {typeof s === 'string' ? s : (s.label || s.type || JSON.stringify(s))}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Instruments */}
              {result.dominant_instruments?.length > 0 && (
                <div className="metric-group">
                  <div className="metric-group-title">Instrumentation</div>
                  <div className="instrument-list">
                    {result.dominant_instruments.map((inst, i) => (
                      <span key={i} className="instrument-tag">{inst}</span>
                    ))}
                  </div>
                  {result.timbral_characteristics && (
                    <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {Object.entries(result.timbral_characteristics).map(([k, v]) =>
                        v != null ? (
                          <span key={k} className="card-source-badge">
                            {k}: {typeof v === 'number' ? Math.round(v * 100) + '%' : v}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Energy / Dynamics */}
              {(result.energy_level || result.dynamic_range) && (
                <div className="metric-group">
                  <div className="metric-group-title">Dynamics</div>
                  <div className="energy-bar-wrapper">
                    <div className="energy-label">
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Energy</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-accent)', fontFamily: 'var(--font-mono)' }}>
                        {result.energy_level || '—'}
                      </span>
                    </div>
                    <div className="energy-bar-track">
                      <div className="energy-bar-fill" style={{
                        width: result.energy_level === 'high' ? '90%' :
                               result.energy_level === 'mid' ? '55%' :
                               result.energy_level === 'low' ? '25%' : '50%'
                      }} />
                    </div>
                    {result.dynamic_range && (
                      <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Dynamic range: {result.dynamic_range}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Duration */}
              {result.duration != null && (
                <div className="metric-group">
                  <div className="metric-group-title">Duration</div>
                  <MetricCard
                    label="Length"
                    value={`${Math.floor(result.duration / 60)}:${String(Math.round(result.duration % 60)).padStart(2, '0')}`}
                    unit="mm:ss"
                  />
                </div>
              )}
            </>
          )}

          {!loading && !result && !error && (
            <div className="empty-state">
              <div className="empty-icon">⚡</div>
              <div className="empty-title">Ready to analyze</div>
              <div className="empty-text">
                Click ⚡ Analyze on any track card to run deep audio analysis — BPM, key, chords, structure, instruments, and more.
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
