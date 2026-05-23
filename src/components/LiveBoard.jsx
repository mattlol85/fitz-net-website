import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import '../css/LiveBoard.css';

const NAVBAR_HEIGHT = 60; // px  (matches --navbar-height in index.css)

function LiveBoard() {
  const { user, token, isAuthenticated } = useAuth();
  const canvasRef = useRef(null);

  // Other users' cursors: { [username]: { xRatio, yRatio } }
  const [cursors, setCursors] = useState({});

  // Board messages: [{ id, username, xRatio, yRatio, content, postedAt }]
  const [messages, setMessages] = useState([]);

  // Compose input state: null | { xRatio, yRatio, clientX, clientY }
  const [compose, setCompose] = useState(null);
  const composeRef = useRef(null);

  // ── RAF-throttled cursor send ────────────────────────────────────────────
  const rafPending = useRef(false);
  const lastCursor = useRef({ xRatio: 0, yRatio: 0 });

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xRatio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const yRatio = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    lastCursor.current = { xRatio, yRatio };

    if (!rafPending.current) {
      rafPending.current = true;
      requestAnimationFrame(() => {
        sendCursor(lastCursor.current.xRatio, lastCursor.current.yRatio);
        rafPending.current = false;
      });
    }
  }, []);

  // ── Double-click → open compose input ───────────────────────────────────
  const handleDoubleClick = useCallback((e) => {
    if (!canvasRef.current) return;
    // Ignore if clicking inside the compose area itself
    if (composeRef.current && composeRef.current.contains(e.target)) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const xRatio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const yRatio = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    setCompose({ xRatio, yRatio, clientX: e.clientX - rect.left, clientY: e.clientY - rect.top });
  }, []);

  const submitMessage = useCallback((content) => {
    if (!compose) return;
    const trimmed = content.trim();
    if (trimmed) {
      sendMessage(compose.xRatio, compose.yRatio, trimmed);
    }
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

  const handleComposeBlur = useCallback(() => {
    setCompose(null);
  }, []);

  // Focus compose textarea when it mounts
  useEffect(() => {
    if (compose && composeRef.current) {
      composeRef.current.focus();
    }
  }, [compose]);

  // ── Message expiry ───────────────────────────────────────────────────────
  const handleMessageExpire = useCallback((id) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  // ── STOMP subscriptions & init ───────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) return;

    init(token);

    const unsubCursors = subscribeCursors(({ username, xRatio, yRatio }) => {
      if (username === user?.username) return; // don't render own cursor
      setCursors(prev => ({ ...prev, [username]: { xRatio, yRatio } }));
    });

    const unsubMessages = subscribeMessages((msg) => {
      setMessages(prev => [...prev, msg]);
    });

    const unsubRemove = subscribeCursorRemove(({ username }) => {
      setCursors(prev => {
        const next = { ...prev };
        delete next[username];
        return next;
      });
    });

    const unsubCleared = subscribeCleared(() => {
      setMessages([]);
      setCursors({});
    });

    const unsubState = subscribeBoardState(({ messages: existing }) => {
      if (Array.isArray(existing)) {
        setMessages(existing);
      }
    });

    return () => {
      unsubCursors();
      unsubMessages();
      unsubRemove();
      unsubCleared();
      unsubState();
      disconnect();
    };
  }, [token, user?.username, isAuthenticated]);

  if (!isAuthenticated()) {
    return (
      <div className="liveboard-gate">
        <p>Please <a href="/login">log in</a> to join the Live Board.</p>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="liveboard-canvas"
      onMouseMove={handleMouseMove}
      onDoubleClick={handleDoubleClick}
      data-testid="liveboard-canvas"
    >
      {/* Hint overlay */}
      <div className="liveboard-hint">Double-click anywhere to leave a message</div>

      {/* Other users' cursors */}
      {Object.entries(cursors).map(([username, { xRatio, yRatio }]) => (
        <LiveCursor key={username} username={username} xRatio={xRatio} yRatio={yRatio} />
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
        <textarea
          ref={composeRef}
          className="liveboard-compose"
          data-testid="liveboard-compose"
          style={{ left: compose.clientX, top: compose.clientY }}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline, Esc to cancel)"
          onKeyDown={handleComposeKeyDown}
          onBlur={handleComposeBlur}
          rows={3}
          maxLength={500}
        />
      )}
    </div>
  );
}

export default LiveBoard;

