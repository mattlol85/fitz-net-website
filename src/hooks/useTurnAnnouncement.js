import { useEffect, useRef, useState } from 'react';

/**
 * A short, screen-reader friendly description of what the current turn is doing, for an
 * aria-live="polite" region: "Loading <model>...", "Generating", then "Reply finished" or the
 * error. It changes only at phase boundaries, so tokens are never read out one by one.
 * Opening or switching conversations announces nothing.
 */
export default function useTurnAnnouncement(messages, streaming, resetKey) {
  const [text, setText] = useState('');
  const sawTurn = useRef(false);
  const last = messages[messages.length - 1];
  const assistant = last?.role === 'assistant' ? last : null;
  const hasOutput = Boolean(assistant?.content || assistant?.thinking);

  // A new chat gets its id (and so a new resetKey) while its first reply is already streaming;
  // that is not a conversation switch, which always stops the stream first.
  useEffect(() => {
    if (streaming) return;
    sawTurn.current = false;
    setText('');
  }, [resetKey]);

  useEffect(() => {
    if (streaming) {
      sawTurn.current = true;
      if (assistant?.live?.text) setText(assistant.live.text);
      else if (hasOutput) setText('Generating');
      else setText('Waiting for the model');
      return;
    }
    if (!sawTurn.current) return;
    sawTurn.current = false;
    if (assistant?.status === 'error') {
      setText(`Error: ${assistant.error?.message || 'the reply failed'}`);
    } else if (assistant?.status === 'cancelled') {
      setText('Reply stopped');
    } else {
      setText('Reply finished');
    }
  }, [streaming, assistant?.live?.text, assistant?.status, assistant?.error?.message, hasOutput]);

  return text;
}
