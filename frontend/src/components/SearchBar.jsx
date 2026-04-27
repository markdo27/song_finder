import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchTracks as spotifySearch, isSpotifyUrl } from '../api/spotify';

const SOURCE_ICONS = {
  youtube: '▶',
  soundcloud: '☁',
  bandcamp: 'B',
  spotify: '♫',
  discogs: '◎',
  link: '🔗',
};

function detectSource(url = '') {
  if (url.includes('youtube') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('soundcloud')) return 'soundcloud';
  if (url.includes('bandcamp')) return 'bandcamp';
  if (url.includes('open.spotify.com') || url.startsWith('spotify:track:')) return 'spotify';
  if (url.includes('discogs')) return 'discogs';
  return null;
}

function isUrl(str) {
  return str.startsWith('http://') || str.startsWith('https://');
}

export default function SearchBar({ onSearch, onLookup, loading }) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const urlSource = detectSource(value);

  // Debounced live suggestions
  useEffect(() => {
    if (isUrl(value) || value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setSuggestionLoading(true);
        const results = await spotifySearch(value, 6);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionLoading(false);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!value.trim()) return;
    setShowSuggestions(false);

    if (isUrl(value)) {
      onLookup?.(value.trim());
    } else {
      onSearch?.(value.trim());
    }
  }, [value, onSearch, onLookup]);

  const handleSuggestionClick = (track) => {
    setValue(`${track.artist} - ${track.track}`);
    setShowSuggestions(false);
    onSearch?.(track.id, true); // pass ID directly
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && selectedIndex >= 0) { handleSuggestionClick(suggestions[selectedIndex]); }
    if (e.key === 'Escape')    { setShowSuggestions(false); setSelectedIndex(-1); }
  };

  return (
    <form className="search-section" onSubmit={handleSubmit} autoComplete="off">
      <div className="search-wrapper">
        <div className="search-input-container">
          <span className="search-icon">
            {urlSource ? SOURCE_ICONS[urlSource] : '🔍'}
          </span>
          <input
            ref={inputRef}
            id="search-input"
            className="search-input"
            type="text"
            value={value}
            onChange={e => { setValue(e.target.value); setSelectedIndex(-1); }}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Paste a YouTube URL or search 'Artist - Track'…"
            autoComplete="off"
            spellCheck={false}
          />
          {value && (
            <button
              type="button"
              className="btn-icon"
              style={{ width: 28, height: 28, fontSize: '0.75rem', border: 'none', background: 'rgba(255,255,255,0.06)' }}
              onClick={() => { setValue(''); setSuggestions([]); setShowSuggestions(false); inputRef.current?.focus(); }}
              title="Clear"
            >✕</button>
          )}
          <button
            id="search-submit-btn"
            type="submit"
            className="search-btn"
            disabled={loading || !value.trim()}
          >
            {loading ? '…' : isUrl(value) ? 'Lookup URL' : 'Find Similar'}
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-dropdown">
            {suggestions.map((track, i) => (
              <div
                key={track.id}
                className={`suggestion-item${i === selectedIndex ? ' active' : ''}`}
                onMouseDown={() => handleSuggestionClick(track)}
              >
                <span className="suggestion-icon">🎵</span>
                <div>
                  <div className="suggestion-track">{track.artist} — {track.track}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        <div className="search-hint">
          <span>▶ YouTube</span>
          <span>☁ SoundCloud</span>
          <span>B Bandcamp</span>
          <span>♫ Spotify</span>
          <span>· or type Artist — Track to search Spotify</span>
        </div>
    </form>
  );
}
