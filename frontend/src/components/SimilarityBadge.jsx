import React, { useEffect, useRef } from 'react';
import { scoreToPercent } from '../api/cosine';

const RING_R = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function getScoreColor(pct) {
  if (pct >= 85) return 'var(--score-high)';
  if (pct >= 70) return 'var(--score-mid)';
  return 'var(--score-low)';
}

export default function SimilarityBadge({ score }) {
  const pct = scoreToPercent(score);
  const strokeColor = getScoreColor(pct);
  const dashOffset = RING_CIRCUMFERENCE - (pct / 100) * RING_CIRCUMFERENCE;
  const fillRef = useRef(null);

  // Animate on mount
  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    // Start at empty, transition to target
    el.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
      el.style.strokeDashoffset = String(dashOffset);
    });
    return () => cancelAnimationFrame(raf);
  }, [dashOffset]);

  return (
    <div className="similarity-badge" title={`${pct}% similar`}>
      <svg className="similarity-ring-svg" viewBox="0 0 52 52">
        <circle className="similarity-ring-bg" cx="26" cy="26" r={RING_R} />
        <circle
          ref={fillRef}
          className="similarity-ring-fill"
          cx="26"
          cy="26"
          r={RING_R}
          stroke={strokeColor}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE}
          style={{ filter: `drop-shadow(0 0 4px ${strokeColor})` }}
        />
      </svg>
      <div className="similarity-badge-label" style={{ color: strokeColor }}>
        {pct}%
      </div>
    </div>
  );
}
