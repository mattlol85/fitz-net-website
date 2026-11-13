import React, { useState } from 'react';
import { formatElapsed } from './aiChatUtils';
import { ChevronRightIcon } from './icons';

/**
 * The model's reasoning. Open while it is thinking (nothing answered yet), collapsed once the
 * answer starts or when loaded from storage; the user can toggle it either way.
 */
export default function ThinkingBlock({ text, active, thinkingMs }) {
  const [userOpen, setUserOpen] = useState(null);
  const open = userOpen ?? active;

  let label = 'Thinking';
  if (active) label = 'Thinking…';
  else if (thinkingMs) label = `Thought for ${formatElapsed(thinkingMs)}`;

  return (
    <div className={`ai-chat__thinking${active ? ' ai-chat__thinking--active' : ''}`}>
      <button
        type="button"
        className="ai-chat__thinking-toggle"
        aria-expanded={open}
        onClick={() => setUserOpen(!open)}
      >
        <ChevronRightIcon size={14} className="ai-chat__thinking-chevron" />
        {label}
      </button>
      {open && (
        <div className="ai-chat__thinking-body" role="region" aria-label="Reasoning">
          {text}
        </div>
      )}
    </div>
  );
}
