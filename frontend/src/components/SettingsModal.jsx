import React, { useState } from 'react';
import { configureSpotify } from '../api/spotify';

export default function SettingsModal({ onClose, onSave }) {
  const [clientId, setClientId] = useState(localStorage.getItem('spotify_client_id') || '');
  const [clientSecret, setClientSecret] = useState(localStorage.getItem('spotify_client_secret') || '');
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('backend_url') || 'http://localhost:8000');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');

  const handleSave = async () => {
    localStorage.setItem('spotify_client_id', clientId.trim());
    localStorage.setItem('spotify_client_secret', clientSecret.trim());
    localStorage.setItem('backend_url', backendUrl.trim() || 'http://localhost:8000');

    setTesting(true);
    setTestError('');
    try {
      await configureSpotify(clientId.trim(), clientSecret.trim());
      setSaved(true);
      setTimeout(() => { setSaved(false); onSave?.(); onClose?.(); }, 800);
    } catch (e) {
      setTestError(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="modal-title">
          ⚙ Settings
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="spotify-client-id">
            Spotify Client ID
          </label>
          <input
            id="spotify-client-id"
            className="settings-input"
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="Your Spotify Client ID…"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="spotify-client-secret">
            Spotify Client Secret
          </label>
          <input
            id="spotify-client-secret"
            className="settings-input"
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            placeholder="Your Spotify Client Secret…"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="settings-hint">
            Create a free app at{' '}
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">
              developer.spotify.com/dashboard
            </a>{' '}
            to get your Client ID & Secret. Use Client Credentials OAuth.
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

        {testError && (
          <div className="error-banner" style={{ marginBottom: 'var(--space-md)', fontSize: '0.82rem' }}>
            ⚠ {testError}
          </div>
        )}

        <div className="divider" />

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>About this app:</strong><br />
          Song Finder uses Spotify's recommendation engine to find similar tracks,
          then ranks them by audio feature similarity (energy, tempo, valence, etc.).
          The local Python backend runs deep audio analysis via bpm-detector on demand.
          Playlists are stored locally in your browser.
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            id="settings-save-btn"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={testing || !clientId.trim() || !clientSecret.trim()}
          >
            {testing ? 'Testing…' : saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
