import React, { useState } from 'react';
import { getApiKey, searchTracks } from '../api/cosine';

export default function SettingsModal({ onClose, onSave }) {
  const [apiKey, setApiKey] = useState(getApiKey());
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('backend_url') || 'http://localhost:8000');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');

  const handleSave = async () => {
    localStorage.setItem('cosine_api_key', apiKey.trim());
    localStorage.setItem('backend_url', backendUrl.trim() || 'http://localhost:8000');

    setTesting(true);
    setTestError('');
    try {
      // Validate by running a lightweight search
      await searchTracks('test', 1);
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
          <label className="settings-label" htmlFor="cosine-api-key">
            cosine.club API Key
          </label>
          <input
            id="cosine-api-key"
            className="settings-input"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Your cosine.club API key…"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="settings-hint">
            Get your free API key at{' '}
            <a href="https://cosine.club/account/api" target="_blank" rel="noopener noreferrer">
              cosine.club/account/api
            </a>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="backend-url-input">
            Analyzer Backend URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
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
            Local Python backend for BPM / key analysis. Start it with{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8em', color: 'var(--text-accent)' }}>
              python backend/main.py
            </code>
          </div>
        </div>

        {testError && (
          <div className="error-banner" style={{ marginBottom: 'var(--space-md)', fontSize: '0.82rem' }}>
            ⚠ {testError}
          </div>
        )}

        <div className="divider" />

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>About:</strong><br />
          Song Finder uses the <strong>cosine.club</strong> music similarity API to find tracks
          that sound like what you love. Paste a YouTube, Discogs, or SoundCloud URL — or
          search by artist + track name. Optional local backend adds BPM &amp; key analysis.
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            id="settings-save-btn"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={testing || !apiKey.trim()}
          >
            {testing ? 'Testing…' : saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
