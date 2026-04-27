import React, { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'songfinder_playlists';

function loadFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveToStorage(playlists) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function PlaylistBuilder({ onTrackPlay, apiKeySet }) {
  const [playlists, setPlaylists] = useState(loadFromStorage);
  const [activeId, setActiveId] = useState(null);
  const [activeTracks, setActiveTracks] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (playlists.length > 0 && !activeId) {
      setActiveId(playlists[0].id);
    }
  }, [playlists, activeId]);

  useEffect(() => {
    if (activeId) {
      const pl = playlists.find(p => p.id === activeId);
      setActiveTracks(pl?.tracks || []);
    } else {
      setActiveTracks([]);
    }
  }, [activeId, playlists]);

  // Expose addTrack method via window (hacky but avoids prop drilling)
  useEffect(() => {
    window.__songFinder_addToPlaylist = (track) => {
      if (!activeId) {
        alert('Create or select a playlist first!');
        return;
      }
      setPlaylists(prev => {
        const updated = prev.map(p =>
          p.id === activeId
            ? { ...p, tracks: [...(p.tracks || []), track] }
            : p
        );
        saveToStorage(updated);
        return updated;
      });
    };
    return () => { delete window.__songFinder_addToPlaylist; };
  }, [activeId]);

  const handleCreate = (e) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    const newPl = { id: generateId(), name: newName.trim(), tracks: [] };
    setPlaylists(prev => {
      const updated = [...prev, newPl];
      saveToStorage(updated);
      return updated;
    });
    setActiveId(newPl.id);
    setActiveTracks([]);
    setCreating(false);
    setNewName('');
  };

  const handleRemoveTrack = (trackId) => {
    if (!activeId) return;
    setPlaylists(prev => {
      const updated = prev.map(p =>
        p.id === activeId
          ? { ...p, tracks: (p.tracks || []).filter(t => t.id !== trackId) }
          : p
      );
      saveToStorage(updated);
      return updated;
    });
  };

  const handleDeletePlaylist = (id) => {
    if (!confirm('Delete this playlist?')) return;
    setPlaylists(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveToStorage(updated);
      return updated;
    });
    if (activeId === id) {
      setActiveId(null);
      setActiveTracks([]);
    }
  };

  if (!apiKeySet) {
    return (
      <aside className="playlist-sidebar">
        <div className="playlist-header">
          <div className="playlist-title-row">
            <span className="playlist-title">📋 Playlists</span>
          </div>
        </div>
        <div className="playlist-empty">
          <div className="playlist-empty-icon">🔑</div>
          <div className="playlist-empty-text">
            Add your Spotify credentials in Settings to enable playlists.
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="playlist-sidebar">
      {/* Header */}
      <div className="playlist-header">
        <div className="playlist-title-row">
          <span className="playlist-title">📋 Playlists</span>
          <span className="playlist-count">{playlists.length}</span>
        </div>
        <button
          className="playlist-new-btn"
          onClick={() => setCreating(c => !c)}
          title="New playlist"
        >
          {creating ? '✕ Cancel' : '+ New'}
        </button>
      </div>

      {/* New playlist form */}
      {creating && (
        <form className="new-playlist-form" onSubmit={handleCreate}>
          <input
            autoFocus
            className="new-playlist-input"
            placeholder="Playlist name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm)' }}>
            Create
          </button>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="error-banner" style={{ margin: 'var(--space-sm)', fontSize: '0.78rem' }}>
          ⚠ {error}
          <button style={{ marginLeft: 'auto', fontSize: '0.8rem', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Playlist selector */}
      <div className="playlist-list">
        {playlists.length === 0 ? (
          <div style={{ padding: 'var(--space-sm)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No playlists yet</div>
        ) : (
          playlists.map(pl => (
            <div
              key={pl.id}
              className={`playlist-item${activeId === pl.id ? ' active' : ''}`}
              onClick={() => setActiveId(pl.id)}
            >
              <span style={{ fontSize: '0.85rem' }}>📁</span>
              <span className="playlist-item-name">{pl.name}</span>
              <span className="playlist-item-count">{(pl.tracks || []).length}</span>
              <button
                style={{ marginLeft: 4, fontSize: '0.72rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                onClick={e => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}
                title="Delete playlist"
              >🗑</button>
            </div>
          ))
        )}
      </div>

      {/* Track list for active playlist */}
      <div className="playlist-tracks">
        {activeTracks.length === 0 ? (
          <div className="playlist-empty">
            <div className="playlist-empty-icon">🎵</div>
            <div className="playlist-empty-text">
              Click "+ Save" on any track card to add it here.
            </div>
          </div>
        ) : (
          activeTracks.map((track, i) => (
            <div key={track.id} className="playlist-track-row">
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 20, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div className="playlist-track-info">
                <div className="playlist-track-name">{track.track}</div>
                <div className="playlist-track-artist">{track.artist}</div>
              </div>
              {(track.preview_url || track.video_uri) && (
                <button
                  className="card-btn play"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  onClick={() => onTrackPlay?.(track)}
                  title="Play"
                >▶</button>
              )}
              <button
                className="playlist-remove-btn"
                onClick={() => handleRemoveTrack(track.id)}
                title="Remove from playlist"
              >✕</button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {activeTracks.length > 0 && (
        <div className="playlist-footer">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: 'var(--space-xs)', alignSelf: 'center' }}>
            {activeTracks.length} track{activeTracks.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </aside>
  );
}
