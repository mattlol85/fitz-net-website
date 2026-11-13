import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ContextRing from '../ContextRing';
import { ArrowUpIcon, StopIcon } from './icons';
import '../../css/ai/composer.css';

const MAX_HEIGHT_PX = 200;

/**
 * The message box: an auto-growing textarea (Enter sends, Shift+Enter adds a line), the context
 * ring, and Send, which turns into Stop while a reply streams.
 */
export default function Composer({ onSend, onStop, streaming, canSend, usage }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const wasStreaming = useRef(streaming);

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

  const submit = async () => {
    const text = value.trim();
    if (!text || streaming || !canSend) return;
    setValue('');
    const result = await onSend(text);
    if (result?.restoreDraft) setValue((current) => current || text);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      className="ai-chat__composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <ContextRing used={usage.used} max={usage.max} alwaysShow />
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={canSend ? 'Message Matt-GPT…' : 'Pick a model to start…'}
        aria-label="Message"
        enterKeyHint="send"
      />
      {streaming ? (
        <button type="button" className="ai-chat__send ai-chat__send--stop" aria-label="Stop" onClick={onStop}>
          <StopIcon size={16} />
        </button>
      ) : (
        <button type="submit" className="ai-chat__send" aria-label="Send" disabled={!value.trim() || !canSend}>
          <ArrowUpIcon size={18} />
        </button>
      )}
    </form>
  );
}
