import React, { useState, useEffect, useRef } from 'react';

export default function Player({ track, onClose }) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef(null);
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const barsRef = useRef(Array.from({ length: 20 }, () => Math.random() * 0.4 + 0.1));

  const videoId = track?.video_id || (track?.video_uri
    ? new URL(track.video_uri).searchParams.get('v') ||
      track.video_uri.split('youtu.be/')[1]?.split('?')[0]
    : null);

  const hasAudioPreview = !!(track?.preview_url);
  const hasYouTube = !!(videoId);

  useEffect(() => {
    if (track) setPlaying(true);
  }, [track?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const bars = barsRef.current;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      if (playing) {
        bars.forEach((_, i) => {
          bars[i] = Math.max(0.05, Math.min(1, bars[i] + (Math.random() - 0.5) * 0.15));
        });
      }
      const barW = W / bars.length - 1;
      bars.forEach((h, i) => {
        const barH = (playing ? h : 0.08) * H;
        const x = i * (barW + 1);
        const y = (H - barH) / 2;
        const alpha = playing ? 0.7 + h * 0.3 : 0.2;
        ctx.fillStyle = `rgba(124, 58, 237, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect?.(x, y, barW, barH, 2) ?? ctx.fillRect(x, y, barW, barH);
        ctx.fill();
      });
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing]);

  if (!track) {
    return (
      <div className="player-bar">
        <div className="player-empty">
          <span>▶</span> Click Play on any track to listen
        </div>
      </div>
    );
  }

  return (
    <div className="player-bar">
      {/* Hidden YouTube iframe */}
      {hasYouTube && (
        <div className="youtube-frame-container">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=${playing ? 1 : 0}&enablejsapi=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="player"
          />
        </div>
      )}

      {/* Hidden audio for Spotify previews */}
      {hasAudioPreview && !hasYouTube && (
        <audio
          ref={audioRef}
          src={track.preview_url}
          onEnded={() => setPlaying(false)}
        />
      )}

      {/* Track info */}
      <div className="player-track-info">
        <div className="player-thumb">🎵</div>
        <div style={{ minWidth: 0 }}>
          <div className="player-track-name">{track.track}</div>
          <div className="player-artist">{track.artist}</div>
        </div>
      </div>

      {/* Waveform */}
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        width={80}
        height={32}
      />

      {/* Controls */}
      <div className="player-controls">
        {(hasYouTube || hasAudioPreview) ? (
          <button
            id="player-play-pause"
            className="player-btn play-pause"
            onClick={() => setPlaying(p => !p)}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : '▶'}
          </button>
        ) : (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0 8px' }}>No preview</span>
        )}
        <button
          className="player-btn"
          onClick={onClose}
          title="Stop & dismiss"
        >
          ✕
        </button>
        {track.external_link && (
          <a
            href={track.external_link}
            target="_blank"
            rel="noopener noreferrer"
            className="player-btn"
            title="Open in Spotify"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
}
