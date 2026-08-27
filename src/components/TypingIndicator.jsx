import React from 'react';
import '../css/LiveBoard.css';

/**
 * A small animated "· · ·" bubble pinned to board coordinates, shown while
 * another user is composing a message at that spot on the Live Board.
 * xRatio / yRatio are 0.0–1.0 fractions of the canvas dimensions.
 */
function TypingIndicator({ username, xRatio, yRatio, color }) {
  const resolvedColor = color || 'var(--link-hover)';
  const style = {
    position: 'absolute',
    left: `${xRatio * 100}%`,
    top: `${yRatio * 100}%`,
  };

  return (
    <div
      className="board-typing"
      style={style}
      data-testid="board-typing"
      data-typing-user={username}
    >
      <span className="board-typing__author" style={{ color: resolvedColor }}>
        {username}
      </span>
      <span className="board-typing__dots" aria-label={`${username} is typing`}>
        <i style={{ background: resolvedColor }} />
        <i style={{ background: resolvedColor }} />
        <i style={{ background: resolvedColor }} />
      </span>
    </div>
  );
}

export default TypingIndicator;
