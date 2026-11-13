import React from 'react';
import Markdown from './Markdown';
import ThinkingBlock from './ThinkingBlock';
import { AlertIcon } from './icons';

/** "model · node" plus an "auto" chip when Auto routed the reply. */
function GenerationTag({ generation }) {
  if (!generation?.model) return null;
  return (
    <div className="ai-chat__tag" data-testid="generation-tag">
      <span className="ai-chat__chip">
        {generation.model}
        {generation.nodeName ? ` · ${generation.nodeName}` : ''}
      </span>
      {generation.auto && <span className="ai-chat__chip ai-chat__chip--auto">auto</span>}
    </div>
  );
}

function MessageBubble({ message }) {
  if (message.role === 'user') {
    return (
      <div className="ai-chat__message ai-chat__message--user" aria-label="You">
        <div className="ai-chat__bubble">
          <p className="ai-chat__user-text">{message.content}</p>
        </div>
      </div>
    );
  }

  const streaming = message.status === 'streaming';
  const hasText = Boolean(message.content);
  const waiting = streaming && !hasText && !message.thinking && !message.live;

  return (
    <div
      className="ai-chat__message ai-chat__message--assistant"
      aria-label="Matt-GPT"
      data-status={message.status}
    >
      <div className="ai-chat__avatar" aria-hidden="true">M</div>
      <div className="ai-chat__bubble">
        {message.thinking && (
          <ThinkingBlock
            text={message.thinking}
            active={streaming && !hasText}
            thinkingMs={message.generation?.thinkingMs}
          />
        )}

        {message.live && (
          <p className="ai-chat__phase" role="status">
            <span className="ai-chat__spinner" aria-hidden="true" />
            {message.live.text}
          </p>
        )}

        {waiting && (
          <span className="ai-chat__typing" role="status" aria-label="Waiting for a reply">
            <i /><i /><i />
          </span>
        )}

        {hasText && (
          <div className="ai-chat__markdown">
            <Markdown>{message.content}</Markdown>
          </div>
        )}

        {message.status === 'cancelled' && (
          <p className="ai-chat__note">{hasText ? 'Stopped.' : 'Stopped before any reply.'}</p>
        )}

        {message.status === 'error' && (
          <div className="ai-chat__error" role="alert">
            <AlertIcon size={16} />
            <span className="ai-chat__error-text">{message.error?.message || 'Something went wrong.'}</span>
            {message.error?.code && <code className="ai-chat__error-code">{message.error.code}</code>}
          </div>
        )}

        <GenerationTag generation={message.generation} />
      </div>
    </div>
  );
}

export default React.memo(MessageBubble);
