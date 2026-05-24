import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FADE_DURATION_MS } from '../services/liveBoardService';
import '../css/LiveBoard.css';

/**
 * A single message pinned to board coordinates.
 * Computes the remaining fade duration from postedAt so late-joiners see
 * the correct remaining lifetime rather than the full duration.
 */
function BoardMessage({ id, username, xRatio, yRatio, content, postedAt, onExpire }) {
  const elapsed = Date.now() - new Date(postedAt).getTime();
  const remaining = FADE_DURATION_MS - elapsed;

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
  }, [id, remaining, onExpire]);

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
    </div>
  );
}

export default BoardMessage;




