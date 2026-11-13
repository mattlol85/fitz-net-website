import React, { useEffect, useMemo, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { MessageControls } from './messageControls';

/**
 * The messages of the open conversation. The whole page scrolls (not this list), so following
 * the stream is done with a sentinel: stay pinned to the end while the reader is near the
 * bottom, stop following when they scroll up to read, and re-pin when `resetKey` changes.
 */
export default function MessageList({
  messages,
  resetKey,
  streaming = false,
  catalogue = null,
  target = null,
  onRegenerate,
  onEdit,
  onOpenPicker,
  onRefreshModels,
}) {
  const endRef = useRef(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const onScroll = () => {
      const distance = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      stickRef.current = distance < 120;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    stickRef.current = true;
  }, [resetKey]);

  // The user just sent something: follow the reply even if they had scrolled up.
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (last?.role === 'user') stickRef.current = true;
  }, [last?.clientKey, last?.role]);

  useEffect(() => {
    if (stickRef.current && typeof endRef.current?.scrollIntoView === 'function') {
      // Instant, not smooth: smooth animations get cancelled by each streamed token.
      endRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages]);

  const controls = useMemo(
    () => ({ disabled: streaming, catalogue, target, onRegenerate, onEdit, onOpenPicker, onRefreshModels }),
    [streaming, catalogue, target, onRegenerate, onEdit, onOpenPicker, onRefreshModels]
  );

  return (
    <MessageControls.Provider value={controls}>
      <div className="ai-chat__messages" data-testid="ai-chat-messages">
        {messages.map((m, index) => (
          <MessageBubble
            key={m.clientKey ?? m.id}
            message={m}
            laterCount={messages.length - 1 - index}
            isLast={index === messages.length - 1}
          />
        ))}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </MessageControls.Provider>
  );
}
