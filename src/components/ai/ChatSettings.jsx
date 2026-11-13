import React, { useEffect, useRef, useState } from 'react';
import Dialog from './Dialog';
import PresetsManager from './PresetsManager';
import { MAX_PROMPT_CHARS } from './aiChatUtils';
import { SlidersIcon } from './icons';
import '../../css/ai/settings.css';

/**
 * The chat settings button, the chips that show what is active (preset name, custom prompt) and
 * the popover: a preset select, the per-chat system prompt override, and Manage presets.
 */
export default function ChatSettings({
  settings,
  presets,
  catalogue,
  canShare,
  onApplyPreset,
  onSavePrompt,
}) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState(settings.systemPrompt || '');
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef(null);

  const activePreset = presets.items.find((p) => p.id === settings.presetId) || null;
  const override = settings.systemPrompt || '';

  // Start each opening from what is stored.
  useEffect(() => {
    if (open) setDraft(override);
  }, [open, override]);

  const close = () => setOpen(false);
  const tooLong = draft.length > MAX_PROMPT_CHARS;
  const changed = draft !== override;

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-chat__settings">
      {activePreset && (
        <button type="button" className="ai-chat__chip-button" onClick={() => setOpen(true)} title="Preset in use">
          {activePreset.name}
        </button>
      )}
      {override && (
        <button type="button" className="ai-chat__chip-button ai-chat__chip-button--marker" onClick={() => setOpen(true)} title="This chat has its own system prompt">
          Custom prompt
        </button>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={`ai-chat__icon-button ai-chat__settings-button${activePreset || override ? ' ai-chat__settings-button--active' : ''}`}
        aria-label="Chat settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersIcon size={18} />
      </button>

      {open && (
        <Dialog
          label="Chat settings"
          variant="popover"
          className="ai-chat__settings-panel"
          openerRef={buttonRef}
          onClose={close}
          showClose
        >
          <h2 className="ai-chat__dialog-title">Chat settings</h2>

          <div className="ai-chat__field">
            <label htmlFor="chat-preset">Preset</label>
            <select
              id="chat-preset"
              value={activePreset ? activePreset.id : ''}
              disabled={busy}
              onChange={(e) => {
                const preset = presets.items.find((p) => p.id === e.target.value) || null;
                run(() => onApplyPreset(preset));
              }}
            >
              <option value="">None</option>
              {presets.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.visibility === 'shared' ? ' (shared)' : ''}
                </option>
              ))}
            </select>
            {activePreset?.model && (
              <p className="ai-chat__field-hint">
                Uses {activePreset.model}
                {activePreset.nodeId ? '' : ' (Auto)'}.
              </p>
            )}
          </div>

          <div className="ai-chat__field">
            <label htmlFor="chat-system-prompt">System prompt for this chat</label>
            <textarea
              id="chat-system-prompt"
              rows={5}
              value={draft}
              placeholder="Overrides the preset's prompt for this chat only"
              onChange={(e) => setDraft(e.target.value)}
            />
            <span className={`ai-chat__counter${tooLong ? ' ai-chat__counter--over' : ''}`}>
              {draft.length} / {MAX_PROMPT_CHARS}
            </span>
            {tooLong && (
              <p className="ai-chat__field-error" role="alert">
                The system prompt can be at most {MAX_PROMPT_CHARS} characters.
              </p>
            )}
            {!override && activePreset?.systemPrompt && (
              <div className="ai-chat__applied">
                <span>Applied from the preset:</span>
                <p>{activePreset.systemPrompt}</p>
              </div>
            )}
            <div className="ai-chat__form-buttons">
              <button
                type="button"
                className="ai-chat__button"
                disabled={busy || !override}
                onClick={() => run(() => onSavePrompt(null))}
              >
                Clear
              </button>
              <button
                type="button"
                className="ai-chat__button ai-chat__button--primary"
                disabled={busy || tooLong || !changed || !draft.trim()}
                onClick={() => run(() => onSavePrompt(draft))}
              >
                Save
              </button>
            </div>
          </div>

          <button type="button" className="ai-chat__button ai-chat__manage" onClick={() => setManaging(true)}>
            Manage presets
          </button>
          {managing && (
            <PresetsManager
              presets={presets}
              catalogue={catalogue}
              canShare={canShare}
              onClose={() => setManaging(false)}
            />
          )}
        </Dialog>
      )}
    </div>
  );
}
