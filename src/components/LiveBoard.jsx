import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  init,
  disconnect,
  sendCursor,
  sendMessage,
  subscribeCursors,
  subscribeMessages,
  subscribeCursorRemove,
  subscribeCleared,
  subscribeBoardState,
} from '../services/liveBoardService';
import LiveCursor from './LiveCursor';
import BoardMessage from './BoardMessage';
import MarkdownToolbar from './MarkdownToolbar';
import { DEFAULT_BOARD_COLOR } from '../constants';
import '../css/LiveBoard.css';

const SNAKE_MAX_AGE         = 1500;  // ms — always-on cursor trail duration
const PAINT_MIN_AGE         = 3000;  // ms — painting trail minimum duration
const PAINT_MAX_AGE         = 5000;  // ms — painting trail maximum duration
const PAINT_DOT_THROTTLE_MS =   80;  // ms — max ~12 paint dots/sec per user
const SPARKLE_THRESH        = 0.05;  // ratio units — proximity to trigger sparkle
const SPARKLE_DEBOUNCE      =  600;  // ms — min interval between sparkles per pair
const OWN_TRAIL_KEY         = '__self__'; // reserved key for own cursor in snakeTrailRef

function LiveBoard() {
  const { user, token, isAuthenticated } = useAuth();
  const canvasRef     = useRef(null);  // outer div
  const trailCanvasRef = useRef(null); // <canvas> overlay for snake trails

  const [cursors, setCursors]       = useState({});
  const [messages, setMessages]     = useState([]);
  const [compose, setCompose]       = useState(null);
  const [ripples, setRipples]       = useState([]);
  const [sparkles, setSparkles]     = useState([]);
  const [paintDots, setPaintDots]   = useState([]);

  const composeRef      = useRef(null);
  const composeWrapRef  = useRef(null);
  const cursorsRef      = useRef({});    // mirrors cursors state, safe to read in callbacks
  const snakeTrailRef   = useRef(new Map()); // username → [{xPct,yPct,t,color}]
  const lastSparkleRef  = useRef({});    // pairKey → timestamp
  const mouseIsDown     = useRef(false);

  // ── RAF-throttled cursor send ────────────────────────────────────────────
  const rafPending = useRef(false);
  const lastCursor = useRef({ xRatio: 0, yRatio: 0 });
  const lastPaintDotRef = useRef({});  // username → last paint-dot timestamp

  const ownColor = useMemo(() => user?.boardColor || DEFAULT_BOARD_COLOR, [user?.boardColor]);

  // ── Helper: push a point to snake trail for a user ───────────────────────
  const pushSnakePoint = useCallback((username, xPct, yPct, color) => {
    const arr = snakeTrailRef.current.get(username) || [];
    arr.push({ xPct, yPct, t: Date.now(), color });
    if (arr.length > 80) arr.shift();
    snakeTrailRef.current.set(username, arr);
  }, []);

  // ── Helper: check sparkle proximity ─────────────────────────────────────
  const checkSparkle = useCallback((usernameA, xA, yA, colorA, usernameB, xB, yB, colorB) => {
    const dx = xA - xB;
    const dy = yA - yB;
    if (Math.sqrt(dx * dx + dy * dy) < SPARKLE_THRESH) {
      const pairKey = [usernameA, usernameB].sort().join('|');
      const last = lastSparkleRef.current[pairKey] || 0;
      if (Date.now() - last > SPARKLE_DEBOUNCE) {
        lastSparkleRef.current[pairKey] = Date.now();
        const id = `sp-${Date.now()}-${Math.random()}`;
        setSparkles(prev => [...prev, {
          id,
          xRatio: (xA + xB) / 2,
          yRatio: (yA + yB) / 2,
          colorA,
          colorB,
        }]);
      }
    }
  }, []);

  // ── Mouse events ─────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(() => { mouseIsDown.current = true; }, []);
  const handleMouseUp   = useCallback(() => { mouseIsDown.current = false; }, []);

  // Reset painting if the mouse is released outside the board element
  useEffect(() => {
    const reset = () => { mouseIsDown.current = false; };
    window.addEventListener('mouseup', reset);
    return () => window.removeEventListener('mouseup', reset);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xRatio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const yRatio = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    lastCursor.current = { xRatio, yRatio };

    // Push own cursor to snake trail
    pushSnakePoint(OWN_TRAIL_KEY, xRatio, yRatio, ownColor);

    // Sparkle: check proximity to all other cursors
    const username = user?.username;
    if (username) {
      Object.entries(cursorsRef.current).forEach(([other, pos]) => {
        checkSparkle(username, xRatio, yRatio, ownColor, other, pos.xRatio, pos.yRatio, pos.color || ownColor);
      });
    }

    if (!rafPending.current) {
      rafPending.current = true;
      requestAnimationFrame(() => {
        sendCursor(lastCursor.current.xRatio, lastCursor.current.yRatio, mouseIsDown.current, ownColor);
        rafPending.current = false;
      });
    }
  }, [user?.username, ownColor, pushSnakePoint, checkSparkle]);

  // ── Left-click → ripple ──────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    if (!canvasRef.current) return;
    if (composeWrapRef.current && composeWrapRef.current.contains(e.target)) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = `${Date.now()}-${Math.random()}`;
    setRipples(prev => [...prev, { id, x, y }]);
  }, []);

  const removeRipple  = useCallback((id) => setRipples(prev => prev.filter(r => r.id !== id)), []);
  const removeSparkle = useCallback((id) => setSparkles(prev => prev.filter(s => s.id !== id)), []);
  const removePaintDot = useCallback((id) => setPaintDots(prev => prev.filter(d => d.id !== id)), []);

  // ── Right-click → compose ────────────────────────────────────────────────
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    if (composeWrapRef.current && composeWrapRef.current.contains(e.target)) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xRatio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const yRatio = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    setCompose({ xRatio, yRatio, clientX: e.clientX - rect.left, clientY: e.clientY - rect.top });
  }, []);

  const submitMessage = useCallback((content) => {
    if (!compose) return;
    const trimmed = content.trim();
    if (trimmed) sendMessage(compose.xRatio, compose.yRatio, trimmed);
    setCompose(null);
  }, [compose]);

  const handleComposeKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setCompose(null);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage(e.target.value);
    }
  }, [submitMessage]);

  const handleComposeBlur = useCallback(() => { setCompose(null); }, []);

  useEffect(() => {
    if (compose && composeRef.current) composeRef.current.focus();
  }, [compose]);

  // ── Message expiry ────────────────────────────────────────────────────────
  const handleMessageExpire = useCallback((id) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  // ── Canvas snake-trail RAF loop ───────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) return;
    const canvas = trailCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Keep canvas pixel dimensions in sync with its CSS size
    const sync = () => {
      const p = canvas.parentElement;
      if (!p) return;
      canvas.width  = p.clientWidth;
      canvas.height = p.clientHeight;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas.parentElement);

    let rafId;
    function draw() {
      const now = Date.now();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const [, points] of snakeTrailRef.current.entries()) {
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const age = now - p.t;
          if (age >= SNAKE_MAX_AGE) continue;
          const progress = age / SNAKE_MAX_AGE; // 0 (fresh) → 1 (old)
          const alpha  = (1 - progress) * 0.6;
          const radius = 2 + 3 * (1 - progress);
          ctx.beginPath();
          ctx.arc(p.xPct * canvas.width, p.yPct * canvas.height, radius, 0, Math.PI * 2);
          ctx.fillStyle    = p.color;
          ctx.globalAlpha  = alpha;
          ctx.fill();
        }
        // Prune stale points
        const fresh = points.filter(p => now - p.t < SNAKE_MAX_AGE);
        if (fresh.length !== points.length) {
          // mutate in place; Map.set also fine but this avoids allocation
          points.splice(0, points.length, ...fresh);
        }
      }
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [token]);

  // ── STOMP subscriptions & init ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) return;

    init(token);

    const unsubCursors = subscribeCursors((data) => {
      const { username, xRatio, yRatio, color = 'hsl(200,72%,50%)', painting = false } = data;
      if (username === user?.username) return;

      // Update cursor state and mirror ref (ref updated outside setState to avoid side effects)
      cursorsRef.current = { ...cursorsRef.current, [username]: { xRatio, yRatio, color } };
      setCursors({ ...cursorsRef.current });

      // Snake trail
      pushSnakePoint(username, xRatio, yRatio, color);

      // Paint dot (long-lived, fades 3–5 s) — throttled to prevent state flooding
      if (painting) {
        const now = Date.now();
        if (now - (lastPaintDotRef.current[username] || 0) > PAINT_DOT_THROTTLE_MS) {
          lastPaintDotRef.current[username] = now;
          const duration = PAINT_MIN_AGE + Math.random() * (PAINT_MAX_AGE - PAINT_MIN_AGE);
          setPaintDots(prev => [...prev, {
            id: `pd-${username}-${now}-${Math.random()}`,
            xRatio, yRatio, color, duration,
          }]);
        }
      }

      // Sparkle: check proximity to own cursor
      checkSparkle(username, xRatio, yRatio, color, user?.username || '', lastCursor.current.xRatio, lastCursor.current.yRatio, ownColor);
    });

    const unsubMessages = subscribeMessages((msg) => {
      setMessages(prev => [...prev, msg]);
    });

    const unsubRemove = subscribeCursorRemove(({ username }) => {
      const next = { ...cursorsRef.current };
      delete next[username];
      cursorsRef.current = next;
      setCursors(next);
      snakeTrailRef.current.delete(username);
      // Prune sparkle pair keys that include this user
      Object.keys(lastSparkleRef.current).forEach(key => {
        if (key.includes(username)) delete lastSparkleRef.current[key];
      });
      delete lastPaintDotRef.current[username];
    });

    const unsubCleared = subscribeCleared(() => {
      setMessages([]);
      setCursors({});
      cursorsRef.current = {};
    });

    const unsubState = subscribeBoardState(({ messages: existing }) => {
      if (Array.isArray(existing)) setMessages(existing);
    });

    return () => {
      unsubCursors();
      unsubMessages();
      unsubRemove();
      unsubCleared();
      unsubState();
      disconnect();
    };
  }, [token, user?.username, isAuthenticated, pushSnakePoint, checkSparkle]);

  if (!isAuthenticated()) {
    return (
      <div className="liveboard-gate">
        <p>Please <Link to="/login">log in</Link> to join the Live Board.</p>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="liveboard-canvas"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      data-testid="liveboard-canvas"
    >
      {/* Snake trail canvas overlay */}
      <canvas
        ref={trailCanvasRef}
        className="liveboard-trail-canvas"
        data-testid="trail-canvas"
      />

      {/* Hint overlay */}
      <div className="liveboard-hint">
        <span>Click for a ripple</span>
        <span className="liveboard-hint__sep" />
        <span>Hold to paint</span>
        <span className="liveboard-hint__sep" />
        <span>Right-click to leave a message</span>
      </div>

      {/* Ripples */}
      {ripples.map(({ id, x, y }) => (
        <div
          key={id}
          className="board-ripple"
          style={{ left: x, top: y }}
          onAnimationEnd={() => removeRipple(id)}
          data-testid="board-ripple"
        />
      ))}

      {/* Sparkles — gradient blends the two colliding users' colors */}
      {sparkles.map(({ id, xRatio, yRatio, colorA, colorB }) => (
        <div
          key={id}
          className="board-sparkle"
          style={{
            left: `${xRatio * 100}%`,
            top: `${yRatio * 100}%`,
            background: `radial-gradient(circle, #fff 0%, ${colorA} 40%, ${colorB} 80%, transparent 100%)`,
          }}
          onAnimationEnd={() => removeSparkle(id)}
          data-testid="board-sparkle"
        />
      ))}

      {/* Paint trail dots */}
      {paintDots.map(({ id, xRatio, yRatio, color, duration }) => (
        <div
          key={id}
          className="paint-dot"
          style={{
            left: `${xRatio * 100}%`,
            top: `${yRatio * 100}%`,
            background: color,
            animationDuration: `${duration}ms`,
          }}
          onAnimationEnd={() => removePaintDot(id)}
          data-testid="paint-dot"
        />
      ))}

      {/* Other users' cursors */}
      {Object.entries(cursors).map(([username, { xRatio, yRatio, color }]) => (
        <LiveCursor key={username} username={username} xRatio={xRatio} yRatio={yRatio} color={color} />
      ))}

      {/* Board messages */}
      {messages.map((msg) => (
        <BoardMessage
          key={msg.id}
          {...msg}
          onExpire={handleMessageExpire}
        />
      ))}

      {/* Compose overlay */}
      {compose && (
        <div
          ref={composeWrapRef}
          className="liveboard-compose-wrap"
          style={{ left: compose.clientX, top: compose.clientY }}
          data-testid="liveboard-compose-wrap"
        >
          <textarea
            ref={composeRef}
            className="liveboard-compose"
            data-testid="liveboard-compose"
            placeholder="Type a message… (Enter to send, Shift+Enter for newline, Esc to cancel)"
            onKeyDown={handleComposeKeyDown}
            onBlur={handleComposeBlur}
            rows={3}
            maxLength={500}
          />
          <MarkdownToolbar textareaRef={composeRef} />
        </div>
      )}
    </div>
  );
}

export default LiveBoard;
