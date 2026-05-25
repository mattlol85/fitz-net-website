import React from 'react';
import '../css/LiveBoard.css';

/**
 * Renders another user's cursor on the board.
 * xRatio / yRatio are 0.0–1.0 fractions of the canvas dimensions.
 * color is the user's assigned board color (hsl string).
 */
function LiveCursor({ username, xRatio, yRatio, color }) {
  const resolvedColor = color || 'var(--button-bg)';

  const style = {
    position: 'absolute',
    left: `${xRatio * 100}%`,
    top: `${yRatio * 100}%`,
    pointerEvents: 'none',
    transform: 'translate(0, 0)',
  };

  return (
    <div className="live-cursor" style={style} data-testid="live-cursor">
      <svg
        className="live-cursor__icon"
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 0L0 16L4.5 11.5L7 18L9 17L6.5 10.5L12 10.5L0 0Z"
          fill={resolvedColor}
          stroke="var(--bg-primary)"
          strokeWidth="1"
        />
      </svg>
      <span
        className="live-cursor__label"
        style={{ background: resolvedColor }}
        data-testid="live-cursor-label"
      >
        {username}
      </span>
    </div>
  );
}

export default LiveCursor;

