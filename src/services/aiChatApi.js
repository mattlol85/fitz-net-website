/**
 * Matt-GPT v2 client for fitz-net-api's `/ai/**` endpoints (docs/ai-chat-contract.md).
 *
 * One function per REST endpoint. Every function takes the caller's JWT first. Plain calls resolve
 * with the parsed JSON body; the three turn streams resolve with the terminal `{ event, data }`
 * after delivering every event to `onEvent(name, data)`.
 *
 * HTTP failures throw ApiError (`status`, `message` from the server's body). Aborting a call's
 * `signal` rejects with an AbortError; for a turn stream that closes the connection, which makes
 * the API stop the generation on the node.
 *
 * With VITE_USE_MOCK_API=true every call is answered by an in-memory mock (loaded lazily, so it
 * never ships in the production path).
 */
import { API_URLS } from '../constants';
import { readSseStream } from './sse';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

// Proxy/edge statuses that mean "the request outlived a timeout between the browser and the API".
const GATEWAY_TIMEOUT_STATUSES = new Set([502, 504, 524]);

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let mockModule = null;
const loadMock = () => {
  mockModule ??= import('./mocks/aiChatMock.js');
  return mockModule;
};

function buildUrl(path, query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return `${API_URLS.FITZ_NET_API}${path}${qs ? `?${qs}` : ''}`;
}

function headers(token, { json = false, accept = 'application/json' } = {}) {
  return {
    Accept: accept,
    ...(json && { 'Content-Type': 'application/json' }),
    Authorization: `Bearer ${token}`,
  };
}

async function toApiError(response, fallback) {
  const data = await response.json().catch(() => null);
  let message = data?.message;
  if (!message && GATEWAY_TIMEOUT_STATUSES.has(response.status)) {
    message = `The server took too long to respond (HTTP ${response.status}).`;
  }
  return new ApiError(message || `${fallback}: ${response.status}`, { status: response.status, data });
}

async function request(method, path, { token, body, query, signal } = {}) {
  if (USE_MOCK) {
    return (await loadMock()).handleRequest(method, path, { body, query, signal });
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: headers(token, { json: body !== undefined }),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw await toApiError(response, 'Request failed');
  return response.json();
}

async function streamTurn(path, body, token, { signal, onEvent } = {}) {
  if (USE_MOCK) {
    return (await loadMock()).handleStream(path, body, { signal, onEvent });
  }

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: headers(token, { json: true, accept: 'text/event-stream' }),
    body: JSON.stringify(body ?? {}),
    signal,
  });
  if (!response.ok) throw await toApiError(response, 'Failed to start the reply');
  return readSseStream(response.body, onEvent, { signal });
}

const id = encodeURIComponent;

// --- Picker catalogue, warm-up, preferences (sections 3, 5, 11) -------------------------------

/** GET /ai/models -> { generatedAt, nodes[], models[] }. `refresh` bypasses the server caches. */
export const listModels = (token, { refresh = false, signal } = {}) =>
  request('GET', '/ai/models', { token, query: { refresh: refresh ? 'true' : undefined }, signal });

/** POST /ai/warmup { model, nodeId } -> { state, nodeId, nodeName, model, message } */
export const warmUp = (token, { model, nodeId = null }, { signal } = {}) =>
  request('POST', '/ai/warmup', { token, body: { model, nodeId }, signal });

/** GET /ai/preferences -> { lastTarget, lastPresetId, updatedAt } */
export const getPreferences = (token, { signal } = {}) => request('GET', '/ai/preferences', { token, signal });

/** PUT /ai/preferences { lastTarget?, lastPresetId? } */
export const updatePreferences = (token, preferences, { signal } = {}) =>
  request('PUT', '/ai/preferences', { token, body: preferences, signal });

// --- Conversations (sections 6, 8) -------------------------------------------------------------

/** GET /ai/conversations?q=&limit=&offset= -> { items, hasMore } */
export const listConversations = (token, { q, limit, offset, signal } = {}) =>
  request('GET', '/ai/conversations', { token, query: { q, limit, offset }, signal });

/** POST /ai/conversations { title?, target?, settings? } -> Conversation */
export const createConversation = (token, body = {}, { signal } = {}) =>
  request('POST', '/ai/conversations', { token, body, signal });

/** GET /ai/conversations/{id} -> ConversationDetail (with summary, context and messages) */
export const getConversation = (token, conversationId, { signal } = {}) =>
  request('GET', `/ai/conversations/${id(conversationId)}`, { token, signal });

/** PATCH /ai/conversations/{id} { title?, pinned?, target?, settings? } -> Conversation */
export const updateConversation = (token, conversationId, patch, { signal } = {}) =>
  request('PATCH', `/ai/conversations/${id(conversationId)}`, { token, body: patch, signal });

/** DELETE /ai/conversations/{id} -> { deleted: true } */
export const deleteConversation = (token, conversationId, { signal } = {}) =>
  request('DELETE', `/ai/conversations/${id(conversationId)}`, { token, signal });

/** POST /ai/conversations/{id}/title -> Conversation (unchanged on any failure) */
export const generateTitle = (token, conversationId, { signal } = {}) =>
  request('POST', `/ai/conversations/${id(conversationId)}/title`, { token, signal });

/** GET /ai/conversations/{id}/context?model=&nodeId= -> ContextUsage. Defaults to the stored target. */
export const getContextUsage = (token, conversationId, { model, nodeId, signal } = {}) =>
  request('GET', `/ai/conversations/${id(conversationId)}/context`, {
    token,
    query: { model, nodeId },
    signal,
  });

/** POST /ai/conversations/{id}/summarize -> { conversation, summary, context } (blocking) */
export const summarizeConversation = (token, conversationId, { signal } = {}) =>
  request('POST', `/ai/conversations/${id(conversationId)}/summarize`, { token, signal });

// --- Turns (section 7) -------------------------------------------------------------------------

/** POST /ai/conversations/{id}/messages { content, attachmentIds?, target? } (SSE) */
export const sendMessage = (token, conversationId, body, options) =>
  streamTurn(`/ai/conversations/${id(conversationId)}/messages`, body, token, options);

/** POST /ai/conversations/{id}/messages/{messageId}/regenerate { target? } (SSE) */
export const regenerateMessage = (token, conversationId, messageId, body, options) =>
  streamTurn(
    `/ai/conversations/${id(conversationId)}/messages/${id(messageId)}/regenerate`,
    body,
    token,
    options
  );

/** POST /ai/conversations/{id}/messages/{messageId}/edit { content, attachmentIds?, target? } (SSE) */
export const editMessage = (token, conversationId, messageId, body, options) =>
  streamTurn(
    `/ai/conversations/${id(conversationId)}/messages/${id(messageId)}/edit`,
    body,
    token,
    options
  );

// --- Attachments (section 10) ------------------------------------------------------------------

/** POST /ai/attachments { name, mimeType, dataBase64 } -> Attachment */
export const uploadAttachment = (token, { name, mimeType, dataBase64 }, { signal } = {}) =>
  request('POST', '/ai/attachments', { token, body: { name, mimeType, dataBase64 }, signal });

/**
 * GET /ai/attachments/{id} -> Blob. `<img>` cannot send the bearer token, so callers show the
 * result through URL.createObjectURL.
 */
export async function fetchAttachment(token, attachmentId, { signal } = {}) {
  if (USE_MOCK) return (await loadMock()).getAttachmentBlob(attachmentId);

  const response = await fetch(buildUrl(`/ai/attachments/${id(attachmentId)}`), {
    headers: headers(token, { accept: '*/*' }),
    signal,
  });
  if (!response.ok) throw await toApiError(response, 'Failed to load the attachment');
  return response.blob();
}

// --- Presets (section 9) -----------------------------------------------------------------------

/** GET /ai/presets -> { items } */
export const listPresets = (token, { signal } = {}) => request('GET', '/ai/presets', { token, signal });

/** POST /ai/presets -> Preset */
export const createPreset = (token, preset, { signal } = {}) =>
  request('POST', '/ai/presets', { token, body: preset, signal });

/** PUT /ai/presets/{id} -> Preset */
export const updatePreset = (token, presetId, preset, { signal } = {}) =>
  request('PUT', `/ai/presets/${id(presetId)}`, { token, body: preset, signal });

/** DELETE /ai/presets/{id} -> { deleted: true } */
export const deletePreset = (token, presetId, { signal } = {}) =>
  request('DELETE', `/ai/presets/${id(presetId)}`, { token, signal });
