import React, { useState } from 'react';
import { hasApiKey } from '../api/cosine';

export default function SettingsModal({ onClose, onSave }) {
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('backend_url') || 'http://localhost:8000');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('backend_url', backendUrl.trim() || 'http://localhost:8000');
    setSaved(true);
    setTimeout(() => { setSaved(false); onSave?.(); onClose?.(); }, 600);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="modal-title">
          ⚙ Settings
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* API status — key is pre-configured server-side on Vercel */}
        <div className="settings-field">
          <label className="settings-label">cosine.club API</label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            color: 'var(--score-high)',
          }}>
            ✓ API key configured — ready to use
          </div>
          <div className="settings-hint">
            The cosine.club API key is pre-configured. No action needed.
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="backend-url-input">
            Analyzer Backend URL{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
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
            Local Python backend for BPM / key analysis. Start with{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8em', color: 'var(--text-accent)' }}>
              python backend/main.py
            </code>
          </div>
        </div>

        <div className="divider" />

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>About:</strong><br />
          Song Finder uses <strong>cosine.club</strong> vector similarity to find tracks that sound alike.
          Paste a YouTube, Discogs, or SoundCloud URL — or search by artist + track name.
          Specialises in underground &amp; electronic music.
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
