/**
 * Minimal Server-Sent Events reader for `fetch` responses.
 *
 * `EventSource` cannot send an Authorization header or a POST body, and it bypasses the
 * `fetch` wrapper that adds X-Correlation-ID, so the AI chat streams are read by hand.
 */

/** Events the AI chat turn stream defines. Anything else is ignored (the contract allows new ones). */
export const TURN_EVENTS = ['meta', 'status', 'thinking', 'token', 'done', 'error'];

/** Events that end a turn. */
const TERMINAL_EVENTS = ['done', 'error'];

export function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export function isAbortError(err) {
  return err?.name === 'AbortError';
}

/** Thrown when the connection ends before the stream's `done` / `error` event. */
export class StreamClosedError extends Error {
  constructor(message = 'The connection closed before the reply finished.') {
    super(message);
    this.name = 'StreamClosedError';
    this.code = 'STREAM_CLOSED';
  }
}

/**
 * Parses one SSE frame (the text between two blank lines). Returns `{ event, data }`, or null for
 * comment-only frames, frames without data and frames whose data is not valid JSON.
 */
export function parseSseFrame(frame) {
  let event = 'message';
  const dataLines = [];

  for (const line of frame.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') event = value.trim();
    else if (field === 'data') dataLines.push(value);
    // `id` and `retry` are irrelevant here.
  }

  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}

/**
 * Reads an SSE response body and calls `onEvent(name, data)` for each recognised event.
 *
 * Resolves with `{ event, data }` of the terminal event (`done` or `error`) once it arrives, and
 * stops reading. Rejects with a StreamClosedError when the body ends first, with an AbortError
 * when `signal` aborts, and with whatever the body stream throws.
 */
export async function readSseStream(body, onEvent, { signal, events = TURN_EVENTS } = {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const known = new Set(events);
  let buffer = '';
  let heldCarriageReturn = false;

  const cancelReader = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  // Returns the terminal event when the frame is one, else undefined.
  const dispatch = (frame) => {
    const parsed = parseSseFrame(frame);
    if (!parsed || !known.has(parsed.event)) return undefined;
    onEvent?.(parsed.event, parsed.data);
    return TERMINAL_EVENTS.includes(parsed.event) ? parsed : undefined;
  };

  // Drains complete frames from the buffer. With `flush`, a trailing unterminated frame counts too.
  const drain = (flush) => {
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const terminal = dispatch(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (terminal) return terminal;
    }
    if (flush && buffer.trim()) {
      const frame = buffer;
      buffer = '';
      return dispatch(frame);
    }
    return undefined;
  };

  try {
    for (;;) {
      if (signal?.aborted) throw abortError();
      const { value, done } = await reader.read();
      // A cancelled reader reports `done`; that is an abort, not a missing terminal event.
      if (signal?.aborted) throw abortError();

      let text = value ? decoder.decode(value, { stream: !done }) : '';
      if (done) text += decoder.decode();
      if (heldCarriageReturn) {
        text = `\r${text}`;
        heldCarriageReturn = false;
      }
      // A CR at the very end may be the first half of CRLF; wait for the next chunk to know.
      if (!done && text.endsWith('\r')) {
        text = text.slice(0, -1);
        heldCarriageReturn = true;
      }
      buffer += text.replace(/\r\n?/g, '\n');

      const terminal = drain(done);
      if (terminal) return terminal;
      if (done) throw new StreamClosedError();
    }
  } finally {
    // Release the connection however we leave (terminal event, abort, error, throwing callback).
    signal?.removeEventListener('abort', cancelReader);
    cancelReader();
  }
}
