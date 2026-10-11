/**
 * AI worker node registry service — powers the Status tab's node graph.
 * Polls GET /node/list on fitz-net-api. In mock mode (VITE_USE_MOCK_API=true)
 * returns a small fake node list so the graph renders before any real node
 * has ever registered.
 */
import { API_URLS } from '../constants';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const MOCK_NODES = [
  {
    id: 'mock-local-5070ti',
    name: 'local-5070ti',
    status: 'ONLINE',
    os: 'Windows',
    models: ['qwen3:14b', 'qwen3-coder:30b'],
    vramGb: 16,
    lastHeartbeatAt: new Date().toISOString(),
  },
  {
    id: 'mock-brother-pc',
    name: 'brother-pc',
    status: 'OFFLINE',
    os: 'Windows',
    models: ['qwen3-coder:30b'],
    vramGb: 24,
    lastHeartbeatAt: new Date(Date.now() - 15 * 60_000).toISOString(),
  },
];

export async function fetchNodes() {
  if (USE_MOCK) {
    return MOCK_NODES;
  }

  const response = await fetch(`${API_URLS.FITZ_NET_API}/node/list`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch node list: ${response.status}`);
  }

  return response.json();
}

/**
 * Generates a one-time node enrollment token (POST /node/enrollment-token).
 * Requires the caller's JWT — only a logged-in user can mint these.
 */
export async function generateEnrollmentToken(authToken, label) {
  if (USE_MOCK) {
    return {
      token: `mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    };
  }

  const response = await fetch(`${API_URLS.FITZ_NET_API}/node/enrollment-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(label ? { label } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Failed to generate enrollment token: ${response.status}`);
  }

  return data;
}

// Proxy/edge statuses that mean "the request outlived a timeout somewhere
// between the browser and the node", rather than an error from the API.
const GATEWAY_TIMEOUT_STATUSES = new Set([502, 504, 524]);

/**
 * Streams a chat from a specific node's Ollama instance via fitz-net-api
 * (POST /node/{id}/chat/stream, Server-Sent Events). Requires the caller's JWT.
 *
 * Calls onToken(text) for each reply chunk and resolves with the full reply
 * once the API sends `done`. Rejects on an `error` event, a non-2xx status, or
 * a stream that ends without `done`. Aborting `signal` closes the connection,
 * which makes the API cancel the generation on the node.
 */
export async function streamChatWithNode(nodeId, prompt, model, authToken, { onToken, signal } = {}) {
  const response = await fetch(`${API_URLS.FITZ_NET_API}/node/${nodeId}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(model ? { prompt, model } : { prompt }),
    signal,
  });

  if (!response.ok) {
    if (GATEWAY_TIMEOUT_STATUSES.has(response.status)) {
      throw new Error(`The node took too long to respond (HTTP ${response.status}).`);
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Failed to reach node: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reply = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      // Frames with no data are keep-alive comments.
      if (!data) continue;

      const payload = JSON.parse(data);
      if (event === 'token') {
        reply += payload.content;
        onToken?.(payload.content);
      } else if (event === 'done') {
        return reply;
      } else if (event === 'error') {
        throw new Error(payload.message || 'The node reported an error.');
      }
    }
  }

  throw new Error('The connection to the node closed before the reply finished.');
}
