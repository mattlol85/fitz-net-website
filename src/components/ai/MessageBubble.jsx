import React, { useContext, useState } from 'react';
import FailoverChoices from './FailoverChoices';
import GenerationStats from './GenerationStats';
import Markdown from './Markdown';
import { AssistantActions, MessageEditor, UserActions } from './MessageActions';
import ThinkingBlock from './ThinkingBlock';
import { MessageControls } from './messageControls';
import { deriveAlternatives, FAILOVER_CODES } from './aiChatUtils';
import { AlertIcon } from './icons';
import '../../css/ai/controls.css';

/** "model · node" plus an "auto" chip when Auto routed the reply, then the reply's stats. */
function GenerationTag({ generation }) {
  if (!generation?.model) return null;
  return (
    <div className="ai-chat__tag" data-testid="generation-tag">
      <span className="ai-chat__chip">
        {generation.model}
        {generation.nodeName ? ` · ${generation.nodeName}` : ''}
      </span>
      {generation.auto && <span className="ai-chat__chip ai-chat__chip--auto">auto</span>}
      <GenerationStats generation={generation} />
    </div>
  );
}

function UserMessage({ message, laterCount }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="ai-chat__message ai-chat__message--user" aria-label="You">
      <div className={`ai-chat__user-col${editing ? ' ai-chat__user-col--editing' : ''}`}>
        {editing ? (
          <MessageEditor message={message} laterCount={laterCount} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <div className="ai-chat__bubble">
              <p className="ai-chat__user-text">{message.content}</p>
            </div>
            <div className="ai-chat__under">
              {message.editedAt && <span className="ai-chat__edited">edited</span>}
              <UserActions message={message} onEdit={() => setEditing(true)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Failover for a failed reply: the API's alternatives, or ones derived from the catalogue. */
function ErrorFailover({ message }) {
  const { disabled, catalogue, target, onRegenerate, onOpenPicker } = useContext(MessageControls);
  const model = message.generation?.model || target?.model;
  const alternatives =
    message.alternatives ?? deriveAlternatives(catalogue, model, message.generation?.nodeId);

  return (
    <FailoverChoices
      alternatives={alternatives}
      model={model}
      disabled={disabled}
      onChoose={(newTarget) => onRegenerate(message, newTarget)}
      onOpenPicker={onOpenPicker}
    />
  );
}

function AssistantMessage({ message, laterCount, isLast }) {
  const { onOpenPicker } = useContext(MessageControls);
  const streaming = message.status === 'streaming';
  const hasText = Boolean(message.content);
  const waiting = streaming && !hasText && !message.thinking && !message.live;
  const interrupted = message.status === 'error' && message.error?.code === 'INTERRUPTED';
  const failed = message.status === 'error' && !interrupted;
  const failoverCode = failed && (FAILOVER_CODES.includes(message.error?.code) || message.alternatives?.length > 0);

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
          <p className="ai-chat__note">{hasText ? 'Stopped' : 'Stopped before any reply'}</p>
        )}

        {interrupted && (
          <p className="ai-chat__note">{hasText ? 'Interrupted' : 'Interrupted before any reply'}</p>
        )}

        {failed && (
          <div className="ai-chat__error" role="alert">
            <AlertIcon size={16} />
            <span className="ai-chat__error-text">
              {message.error?.message || 'Something went wrong.'}
              {message.error?.code === 'CONTEXT_TOO_SMALL' && (
                <>
                  {' '}
                  This model&apos;s context window is too small for the newest message. Try a model with a larger window.
                  <button type="button" className="ai-chat__link-button" onClick={onOpenPicker}>
                    Choose a model
                  </button>
                </>
              )}
            </span>
            {message.error?.code && <code className="ai-chat__error-code">{message.error.code}</code>}
          </div>
        )}

        {message.contextOverflow && (
          <p className="ai-chat__warn" role="status">
            <AlertIcon size={14} /> The model&apos;s window was full; early context may have been cut.
          </p>
        )}

        {failoverCode && isLast && <ErrorFailover message={message} />}

        <GenerationTag generation={message.generation} />

        {!streaming && <AssistantActions message={message} laterCount={laterCount} />}
      </div>
    </div>
  );
}

function MessageBubble({ message, laterCount = 0, isLast = false }) {
  if (message.role === 'user') return <UserMessage message={message} laterCount={laterCount} />;
  return <AssistantMessage message={message} laterCount={laterCount} isLast={isLast} />;
}

export default React.memo(MessageBubble);
