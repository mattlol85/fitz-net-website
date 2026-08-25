import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FADE_DURATION_MS } from '../services/liveBoardService';
import '../css/LiveBoard.css';

/**
 * A single message pinned to board coordinates.
 * Computes the remaining fade duration from postedAt ONCE on mount (via useRef)
 * so re-renders (e.g. new messages arriving) never reset the fade or timer bar.
 */
function BoardMessage({ id, username, xRatio, yRatio, content, postedAt, onExpire }) {
  // Stable: computed once on mount, never recalculated on re-render
  const remaining = useRef(
    FADE_DURATION_MS - (Date.now() - new Date(postedAt).getTime())
  ).current;

  const [visible, setVisible] = useState(remaining > 0);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.(id);
      return;
    }
    const timer = setTimeout(() => {
      setVisible(false);
      onExpire?.(id);
    }, remaining);
    return () => clearTimeout(timer);
  // remaining is now stable (ref), so this effect only runs once per mount
  }, [id, onExpire]);

  if (!visible) return null;

  const style = {
    position: 'absolute',
    left: `${xRatio * 100}%`,
    top: `${yRatio * 100}%`,
    animation: `board-fade-out ${remaining}ms linear forwards`,
  };

  return (
    <div
      className="board-message"
      style={style}
      data-testid="board-message"
      data-message-id={id}
    >
      <span className="board-message__author">{username}</span>
      <div className="board-message__content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          // rehype-raw is intentionally NOT used — no raw HTML allowed
          components={{
            // Open links in new tab safely
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {/* Lifetime indicator: depletes left-to-right in sync with the fade */}
      <div
        className="board-message__timer"
        style={{ animationDuration: `${remaining}ms` }}
        aria-hidden="true"
      />
    </div>
  );
}

export default BoardMessage;
