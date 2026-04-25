import React, { useEffect, useCallback } from 'react';

const KEY_MAP = {
  w: { type: 'move', direction: 'forward' },
  s: { type: 'move', direction: 'back' },
  a: { type: 'move', direction: 'left' },
  d: { type: 'move', direction: 'right' },
  ' ': { type: 'jump' },
  shift: { type: 'sneak' },
};

function MinecraftControls({ sendControl, isOnline }) {

  const handleKeyDown = useCallback((e) => {
    if (!isOnline) return;
    // Don't capture if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();
    const mapping = KEY_MAP[key];
    if (mapping) {
      e.preventDefault();
      sendControl({ ...mapping, state: true });
    }
  }, [sendControl, isOnline]);

  const handleKeyUp = useCallback((e) => {
    if (!isOnline) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();
    const mapping = KEY_MAP[key];
    if (mapping) {
      e.preventDefault();
      sendControl({ ...mapping, state: false });
    }
  }, [sendControl, isOnline]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Mobile / on-screen button helpers
  const press = (cmd) => sendControl({ ...cmd, state: true });
  const release = (cmd) => sendControl({ ...cmd, state: false });

  return (
    <div className="mc-controls">
      <div className="mc-controls-label">Controls — WASD + Space (jump) + Shift (sneak)</div>
      <div className="mc-controls-grid">
        <div className="mc-controls-row">
          <button
            className="mc-ctrl-btn"
            onMouseDown={() => press({ type: 'move', direction: 'forward' })}
            onMouseUp={() => release({ type: 'move', direction: 'forward' })}
            onMouseLeave={() => release({ type: 'move', direction: 'forward' })}
            disabled={!isOnline}
          >W</button>
        </div>
        <div className="mc-controls-row">
          <button
            className="mc-ctrl-btn"
            onMouseDown={() => press({ type: 'move', direction: 'left' })}
            onMouseUp={() => release({ type: 'move', direction: 'left' })}
            onMouseLeave={() => release({ type: 'move', direction: 'left' })}
            disabled={!isOnline}
          >A</button>
          <button
            className="mc-ctrl-btn"
            onMouseDown={() => press({ type: 'move', direction: 'back' })}
            onMouseUp={() => release({ type: 'move', direction: 'back' })}
            onMouseLeave={() => release({ type: 'move', direction: 'back' })}
            disabled={!isOnline}
          >S</button>
          <button
            className="mc-ctrl-btn"
            onMouseDown={() => press({ type: 'move', direction: 'right' })}
            onMouseUp={() => release({ type: 'move', direction: 'right' })}
            onMouseLeave={() => release({ type: 'move', direction: 'right' })}
            disabled={!isOnline}
          >D</button>
        </div>
        <div className="mc-controls-row">
          <button
            className="mc-ctrl-btn wide"
            onMouseDown={() => press({ type: 'jump' })}
            onMouseUp={() => release({ type: 'jump' })}
            onMouseLeave={() => release({ type: 'jump' })}
            disabled={!isOnline}
          >Space</button>
          <button
            className="mc-ctrl-btn"
            onMouseDown={() => sendControl({ type: 'action', action: 'attack' })}
            disabled={!isOnline}
          >⚔️</button>
        </div>
      </div>
    </div>
  );
}

export default MinecraftControls;

