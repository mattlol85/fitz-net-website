import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useAttachments from '../../hooks/useAttachments';
import ContextRing from '../ContextRing';
import { IMAGE_TYPES, MAX_ATTACHMENTS } from './aiChatUtils';
import { ArrowUpIcon, CloseIcon, PaperclipIcon, StopIcon } from './icons';
import '../../css/ai/composer.css';
import '../../css/ai/attachments.css';

const MAX_HEIGHT_PX = 200;
const NO_VISION = "This model can't read images";

const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files');

/**
 * The message box: an auto-growing textarea (Enter sends, Shift+Enter adds a line), the context
 * ring, an attach button (images, only for vision models; also paste and drag-and-drop) and Send,
 * which turns into Stop while a reply streams.
 */
export default function Composer({ onSend, onStop, streaming, canSend, usage, vision = false }) {
  const { token } = useAuth();
  const [value, setValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const wasStreaming = useRef(streaming);
  const hintId = useId();
  const attachments = useAttachments({ token });
  const { items } = attachments;

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, []);
  useLayoutEffect(resize, [value, resize]);

  // Hand the cursor back when a reply ends, unless the user went elsewhere meanwhile.
  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      const active = document.activeElement;
      if (!active || active === document.body || active.getAttribute?.('aria-label') === 'Stop') {
        textareaRef.current?.focus();
      }
    }
    wasStreaming.current = streaming;
  }, [streaming]);

  const uploading = items.some((i) => i.status === 'uploading');
  const failed = items.some((i) => i.status === 'error');
  const ready = items.filter((i) => i.status === 'ready');
  const imagesBlocked = items.length > 0 && !vision;
  const hasContent = value.trim().length > 0 || ready.length > 0;
  const canSubmit = hasContent && canSend && !streaming && !uploading && !failed && !imagesBlocked;

  let sendHint = null;
  if (imagesBlocked) sendHint = 'Switch to a vision model or remove the images';
  else if (uploading) sendHint = 'Waiting for the images to upload';
  else if (failed) sendHint = 'Remove the images that failed to upload';

  const submit = async () => {
    if (!canSubmit) return;
    const text = value.trim();
    const taken = attachments.take();
    setValue('');
    const result = await onSend(
      text,
      taken.filter((i) => i.status === 'ready').map((i) => i.attachment)
    );
    if (result?.restoreDraft) {
      setValue((current) => current || text);
      attachments.restore(taken);
    } else {
      attachments.release(taken);
    }
  };

  const addFiles = (files) => {
    if (!vision) {
      attachments.setMessage(NO_VISION);
      return;
    }
    attachments.add(files);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    // A screenshot has no text; if there is text too, let it paste as usual.
    if (!e.clipboardData.getData?.('text/plain')) e.preventDefault();
    addFiles(files);
  };

  const onDrop = (e) => {
    setDragging(false);
    if (!hasFiles(e)) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return (
    <form
      className={`ai-chat__composer${dragging ? ' ai-chat__composer--drag' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {items.length > 0 && (
        <ul className="ai-chat__pending" aria-label="Images to send">
          {items.map((item) => (
            <li key={item.key} className={`ai-chat__pending-item ai-chat__pending-item--${item.status}`}>
              {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <span className="ai-chat__pending-blank" />}
              {item.status === 'uploading' && (
                <span className="ai-chat__pending-state" role="status">
                  <span className="ai-chat__spinner" aria-hidden="true" />
                  <span className="ai-chat__sr">Uploading {item.name}</span>
                </span>
              )}
              {item.status === 'error' && (
                <span className="ai-chat__pending-state ai-chat__pending-state--error" title={item.error}>
                  Failed
                </span>
              )}
              <button
                type="button"
                className="ai-chat__pending-remove"
                aria-label={`Remove ${item.name}`}
                onClick={() => attachments.remove(item.key)}
              >
                <CloseIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {attachments.message && (
        <p className="ai-chat__composer-note ai-chat__composer-note--error" role="alert">
          {attachments.message}
        </p>
      )}
      {sendHint && (
        <p className="ai-chat__composer-note" role="status">
          {sendHint}
        </p>
      )}

      <div className="ai-chat__composer-row">
        <ContextRing used={usage.used} max={usage.max} alwaysShow />
        <button
          type="button"
          className="ai-chat__icon-button ai-chat__attach"
          aria-label="Attach image"
          aria-describedby={vision ? undefined : hintId}
          title={vision ? 'Attach image' : NO_VISION}
          disabled={!vision || items.length >= MAX_ATTACHMENTS}
          onClick={() => fileInputRef.current?.click()}
        >
          <PaperclipIcon size={18} />
        </button>
        {!vision && (
          <span id={hintId} className="ai-chat__sr">
            {NO_VISION}
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept={IMAGE_TYPES.join(',')}
          aria-label="Choose images"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={canSend ? 'Message Matt-GPT…' : 'Pick a model to start…'}
          aria-label="Message"
          enterKeyHint="send"
        />
        {streaming ? (
          <button type="button" className="ai-chat__send ai-chat__send--stop" aria-label="Stop" onClick={onStop}>
            <StopIcon size={16} />
          </button>
        ) : (
          <button type="submit" className="ai-chat__send" aria-label="Send" title={sendHint || undefined} disabled={!canSubmit}>
            <ArrowUpIcon size={18} />
          </button>
        )}
      </div>
    </form>
  );
}
