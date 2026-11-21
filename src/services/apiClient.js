/**
 * Shared JSON client for fitz-net-api, used by feature clients such as aiChatApi.js and
 * recipesApi.js. It knows nothing about any one feature: each client keeps its own paths, its own
 * mock and its own error messages.
 *
 * Calls go through the global `fetch`, so the tracing wrapper (utils/tracing.js) adds the
 * X-Correlation-ID and the session wrapper (services/session.js) retries a 401 with a fresh token.
 * HTTP failures throw ApiError (`status`, `message` from the server's body).
 */
import { API_URLS } from '../constants';

/** VITE_USE_MOCK_API=true: feature clients answer from their in-memory mocks instead. */
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

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

/**
 * `${API base}${path}?query`. Empty values are dropped; an array value repeats the key
 * (`{ ingredient: ['egg', 'flour'] }` -> `ingredient=egg&ingredient=flour`).
 */
export function buildUrl(path, query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((v) => {
      if (v !== undefined && v !== null && v !== '') params.append(key, String(v));
    });
  });
  const qs = params.toString();
  return `${API_URLS.FITZ_NET_API}${path}${qs ? `?${qs}` : ''}`;
}

export function authHeaders(token, { json = false, accept = 'application/json' } = {}) {
  return {
    Accept: accept,
    ...(json && { 'Content-Type': 'application/json' }),
    Authorization: `Bearer ${token}`,
  };
}

export async function toApiError(response, fallback) {
  const data = await response.json().catch(() => null);
  let message = data?.message;
  if (!message && GATEWAY_TIMEOUT_STATUSES.has(response.status)) {
    message = `The server took too long to respond (HTTP ${response.status}).`;
  }
  return new ApiError(message || `${fallback}: ${response.status}`, { status: response.status, data });
}

/** One JSON call: resolves with the parsed body or throws ApiError. */
export async function request(method, path, { token, body, query, signal } = {}) {
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: authHeaders(token, { json: body !== undefined }),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw await toApiError(response, 'Request failed');
  return response.json();
}

/** GET raw bytes (an image the page shows through an object URL). Resolves a Blob. */
export async function requestBlob(path, { token, signal, fallback = 'Download failed' } = {}) {
  const response = await fetch(buildUrl(path), {
    headers: authHeaders(token, { accept: '*/*' }),
    signal,
  });
  if (!response.ok) throw await toApiError(response, fallback);
  return response.blob();
}
