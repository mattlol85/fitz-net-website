import React from 'react';

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Level thresholds for the ring colour, as a fraction of the context window. */
export function contextLevel(fraction) {
  if (fraction >= 0.9) return 'danger';
  if (fraction >= 0.7) return 'warn';
  return 'ok';
}

/** A small circular gauge showing how much of the model's context window is in use. */
export default function ContextRing({ used, max, alwaysShow = false }) {
  if (!max && !alwaysShow) return null;
  const fraction = max ? Math.min(Math.max(used / max, 0), 1) : 0;
  const percent = Math.round(fraction * 100);
  const label = max
    ? `Context: ${used.toLocaleString()} / ${max.toLocaleString()} tokens (${percent}%)`
    : 'Context: unknown until a model replies';

  return (
    <span
      className={`context-ring context-ring--${contextLevel(fraction)}`}
      role="img"
      aria-label={label}
      title={label}
      data-testid="context-ring"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle className="context-ring__track" cx="12" cy="12" r={RADIUS} fill="none" strokeWidth="3" />
        <circle
          className="context-ring__value"
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span className="context-ring__percent">{percent}%</span>
    </span>
  );
}
