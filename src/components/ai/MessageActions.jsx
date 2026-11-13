import React, { useContext, useRef, useState } from 'react';
import useCopy from '../../hooks/useCopy';
import ModelPicker from './ModelPicker';
import { MessageControls } from './messageControls';
import { CopyIcon, CheckIcon, PencilIcon, RetryIcon, SwapIcon } from './icons';

function CopyButton({ text }) {
  const [copied, copy] = useCopy();
  return (
    <button
      type="button"
      className="ai-chat__action"
      aria-label={copied ? 'Copied' : 'Copy message'}
      disabled={!text}
      onClick={() => copy(text)}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Copy, Regenerate and Regenerate with... for an assistant message. */
export function AssistantActions({ message, laterCount, picker, onPickerChange }) {
  const { disabled, catalogue, target, onRegenerate, onRefreshModels } = useContext(MessageControls);
  const pickerOpen = Boolean(picker);
  const [confirm, setConfirm] = useState(null);
  const withRef = useRef(null);

  const run = (newTarget) => {
    setConfirm(null);
    onRegenerate(message, newTarget);
  };
  // Regenerating deletes everything after the message, so ask first when something would go.
  const request = (newTarget) => (laterCount > 0 ? setConfirm({ target: newTarget }) : run(newTarget));

  if (confirm) {
    return (
      <div className="ai-chat__actions ai-chat__actions--open" role="group" aria-label="Confirm regenerate">
        <span className="ai-chat__confirm-text">
          Regenerating removes the {plural(laterCount, 'later message')}.
        </span>
        <button type="button" className="ai-chat__button ai-chat__button--danger" disabled={disabled} onClick={() => run(confirm.target)}>
          Regenerate anyway
        </button>
        <button type="button" className="ai-chat__button" onClick={() => setConfirm(null)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={`ai-chat__actions${pickerOpen ? ' ai-chat__actions--open' : ''}`}>
      <CopyButton text={message.content} />
      <button type="button" className="ai-chat__action" disabled={disabled} onClick={() => request(undefined)}>
        <RetryIcon size={14} /> Regenerate
      </button>
      <span className="ai-chat__action-anchor">
        <button
          ref={withRef}
          type="button"
          className="ai-chat__action"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          disabled={disabled || !catalogue}
          onClick={() => onPickerChange('any')}
        >
          <SwapIcon size={14} /> Regenerate with…
        </button>
        {pickerOpen && (
          <ModelPicker
            open
            hideButton
            shortcut={false}
            title={picker === 'vision' ? 'Choose a vision model for this answer' : 'Choose a model for this answer'}
            visionOnly={picker === 'vision'}
            className="ai-chat__picker--inline"
            catalogue={catalogue}
            target={target}
            onSelect={request}
            onOpenChange={(open) => {
              if (!open) {
                onPickerChange(null);
                withRef.current?.focus();
              }
            }}
            onRefresh={onRefreshModels}
          />
        )}
      </span>
    </div>
  );
}

/** Copy and Edit for a user message. `onEdit` starts the inline editor owned by the bubble. */
export function UserActions({ message, onEdit }) {
  const { disabled } = useContext(MessageControls);
  return (
    <div className="ai-chat__actions">
      <CopyButton text={message.content} />
      <button type="button" className="ai-chat__action" disabled={disabled} onClick={onEdit}>
        <PencilIcon size={14} /> Edit
      </button>
    </div>
  );
}

/** The inline editor that replaces a user bubble: Save & send re-answers and drops what follows. */
export function MessageEditor({ message, laterCount, onCancel }) {
  const { disabled, onEdit } = useContext(MessageControls);
  const [value, setValue] = useState(message.content);
  const canSave = value.trim().length > 0 && !disabled;

  const save = () => {
    if (!canSave) return;
    onCancel();
    onEdit(message, value);
  };

  return (
    <div className="ai-chat__editor">
      <textarea
        autoFocus
        rows={Math.min(8, Math.max(2, value.split('\n').length))}
        aria-label="Edit message"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
            e.preventDefault();
            save();
          }
        }}
      />
      <p className="ai-chat__editor-hint">
        {laterCount > 0
          ? `Saving removes the ${plural(laterCount, 'later message')} and answers again.`
          : 'Saving answers this message again.'}
      </p>
      <div className="ai-chat__editor-buttons">
        <button type="button" className="ai-chat__button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="ai-chat__button ai-chat__button--primary" disabled={!canSave} onClick={save}>
          Save &amp; send
        </button>
      </div>
    </div>
  );
}
