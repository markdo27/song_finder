import React, { useState } from 'react';

export default function SettingsModal({ onClose, onSave }) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('cosine_api_key') || '');
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('backend_url') || 'http://localhost:8000');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('cosine_api_key', apiKey.trim());
    localStorage.setItem('backend_url', backendUrl.trim() || 'http://localhost:8000');
    setSaved(true);
    setTimeout(() => { setSaved(false); onSave?.(); onClose?.(); }, 800);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="modal-title">
          ⚙ Settings
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="api-key-input">
            cosine.club API Key
          </label>
          <input
            id="api-key-input"
            className="settings-input"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Your API key…"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="settings-hint">
            Get your free API key at{' '}
            <a href="https://cosine.club/account/api" target="_blank" rel="noopener noreferrer">
              cosine.club/account/api
            </a>{' '}
            — 120 req/min, free.
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="backend-url-input">
            Analyzer Backend URL
          </label>
          <input
            id="backend-url-input"
            className="settings-input"
            type="text"
            value={backendUrl}
            onChange={e => setBackendUrl(e.target.value)}
            placeholder="http://localhost:8000"
            spellCheck={false}
          />
          <div className="settings-hint">
            The local Python FastAPI server that runs bpm-detector analysis.
            Start it with <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8em', color: 'var(--text-accent)' }}>npm run dev</code> from the project root.
          </div>
        </div>

        <div className="divider" />

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>About this app:</strong><br />
          Song Finder uses cosine.club's ML-powered vector similarity (1.9M+ track database) to find
          tracks that <em>sound</em> similar — not just same genre tags. The local Python backend
          runs deep audio analysis via bpm-detector on demand.
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            id="settings-save-btn"
            className="btn btn-primary"
            onClick={handleSave}
          >
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
