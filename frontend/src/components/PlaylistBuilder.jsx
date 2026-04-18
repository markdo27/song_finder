import React, { useState, useEffect, useCallback } from 'react';
import {
  listPlaylists, createPlaylist, deletePlaylist,
  addTrackToPlaylist, removeTrackFromPlaylist, getPlaylist,
} from '../api/cosine';

export default function PlaylistBuilder({ onTrackPlay, apiKeySet }) {
  const [playlists, setPlaylists] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeTracks, setActiveTracks] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPlaylists = useCallback(async () => {
    if (!apiKeySet) return;
    try {
      setLoading(true);
      const data = await listPlaylists();
      setPlaylists(data);
      if (data.length > 0 && !activeId) {
        setActiveId(data[0].id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiKeySet, activeId]);

  const loadPlaylistTracks = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await getPlaylist(id);
      setActiveTracks(data.tracks || []);
    } catch {
      setActiveTracks([]);
    }
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);
  useEffect(() => { if (activeId) loadPlaylistTracks(activeId); }, [activeId, loadPlaylistTracks]);

  // Expose addTrack method via window (hacky but avoids prop drilling)
  useEffect(() => {
    window.__songFinder_addToPlaylist = async (track) => {
      if (!activeId) {
        alert('Create or select a playlist first!');
        return;
      }
      try {
        await addTrackToPlaylist(activeId, track.id);
        await loadPlaylistTracks(activeId);
      } catch (e) {
        setError(e.message);
      }
    };
    return () => { delete window.__songFinder_addToPlaylist; };
  }, [activeId, loadPlaylistTracks]);

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    try {
      const pl = await createPlaylist(newName.trim());
      setPlaylists(prev => [...prev, pl]);
      setActiveId(pl.id);
      setActiveTracks([]);
      setCreating(false);
      setNewName('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveTrack = async (trackId) => {
    if (!activeId) return;
    try {
      await removeTrackFromPlaylist(activeId, trackId);
      setActiveTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeletePlaylist = async (id) => {
    if (!confirm('Delete this playlist?')) return;
    try {
      await deletePlaylist(id);
      setPlaylists(prev => prev.filter(p => p.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setActiveTracks([]);
      }
    } catch (e) {
      setError(e.message);
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
            Add your cosine.club API key in Settings to enable playlists.
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
        {loading && !playlists.length ? (
          <div style={{ padding: 'var(--space-md)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading…</div>
        ) : playlists.length === 0 ? (
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
              <span className="playlist-item-count">{pl.track_count}</span>
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
              {track.video_uri && (
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
          {playlists.find(p => p.id === activeId)?.public_id && (
            <a
              href={`https://cosine.club/playlists/${playlists.find(p => p.id === activeId)?.public_id}-${playlists.find(p => p.id === activeId)?.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="playlist-action-btn"
              style={{ textDecoration: 'none' }}
            >
              ↗ View on cosine.club
            </a>
          )}
        </div>
      )}
    </aside>
  );
}
