// End-to-end request tracing: every request to a Fitz-Net backend carries an X-Correlation-ID that
// the API, GamerBell and Fitz-Bot put in their logs, so one id finds a request across all of them.
import { API_URLS } from '../constants';

export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

/** A short id matching what the backends accept: letters, digits and `.`, `_`, `:`, `-` (max 64). */
export function newCorrelationId() {
  const random =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return `web-${random}`;
}

/** Origins that are ours; adding a custom header to a foreign origin would break its CORS. */
function isTracedUrl(url) {
  if (url.startsWith('/')) return true;
  try {
    const target = new URL(url, window.location.href);
    return (
      target.origin === window.location.origin ||
      [API_URLS.FITZ_NET_API, API_URLS.GAMERBELL].some((base) => {
        try {
          return new URL(base, window.location.href).origin === target.origin;
        } catch {
          return false;
        }
      })
    );
  } catch {
    return false;
  }
}

/** Wraps window.fetch once so each call to a Fitz-Net backend gets a fresh correlation id. */
export function installFetchTracing() {
  if (typeof window === 'undefined' || !window.fetch || window.fetch.__traced) return;
  const originalFetch = window.fetch.bind(window);
  const tracedFetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    if (!isTracedUrl(url)) return originalFetch(input, init);
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    if (!headers.has(CORRELATION_ID_HEADER)) headers.set(CORRELATION_ID_HEADER, newCorrelationId());
    return originalFetch(input, { ...init, headers });
  };
  tracedFetch.__traced = true;
  window.fetch = tracedFetch;
}

/** Appends a correlationId query parameter; browsers cannot set headers on a WebSocket. */
export function withCorrelationId(wsUrl, correlationId = newCorrelationId()) {
  const separator = wsUrl.includes('?') ? '&' : '?';
  return `${wsUrl}${separator}correlationId=${encodeURIComponent(correlationId)}`;
}
