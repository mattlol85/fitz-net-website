// Session refresh. Sign-in tokens last two hours, and a page left open outlives them. Instead of
// every signed-in request failing with 401 from then on, the user is asked to sign in again (the
// card AuthProvider renders) and the request is sent again with the new token.
import { isTracedUrl } from '../utils/tracing';

// setTimeout overflows past 2^31 - 1 ms and fires at once, so long waits are split.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

let bridge = null;
let pending = null;

/** Expiry of a JWT in epoch milliseconds, or null when it has none or cannot be read. */
export function tokenExpiresAt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '='))).exp;
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Calls `onExpired` once `token` has expired; returns a cancel function. */
export function watchExpiry(token, onExpired) {
  const expiresAt = token ? tokenExpiresAt(token) : null;
  if (expiresAt === null) return () => {};
  let timer;
  const check = () => {
    const left = expiresAt - Date.now();
    if (left <= 0) onExpired();
    else timer = setTimeout(check, Math.min(left, MAX_TIMEOUT_MS));
  };
  check();
  return () => clearTimeout(timer);
}

/**
 * Registers how to get a fresh token: `currentToken()` returns the live session token (null when
 * signed out) and `prompt()` asks the user to sign in again, resolving with the new token, or with
 * null when they sign out instead. Returns an unregister function.
 */
export function registerSessionBridge(next) {
  bridge = next;
  return () => {
    if (bridge === next) bridge = null;
  };
}

/**
 * Resolves with the token to retry a 401 with, or null to give up. A request sent with an older
 * token than the live one (it started before the user signed in again) gets the live token without
 * a prompt; concurrent callers share one prompt.
 */
export function freshToken(rejectedToken) {
  const current = bridge?.currentToken() ?? null;
  if (!current) return Promise.resolve(null);
  if (current !== rejectedToken) return Promise.resolve(current);
  if (!pending) {
    pending = Promise.resolve()
      .then(() => bridge?.prompt() ?? null)
      .catch(() => null)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

const abortReason = (signal) => signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');

/** `promise`, but rejecting as fetch would as soon as `signal` aborts (the caller moved on). */
function untilAborted(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return null; // a Request object: its body may already be used, so it is never replayed
}

/**
 * Wraps window.fetch once: a 401 to a Fitz-Net backend on a request that carried a bearer token
 * waits for a fresh token and is sent once more with it. When the user signs out instead, the
 * original 401 response is returned unread, so callers handle it as before; a caller that aborts
 * while waiting gets the usual AbortError.
 */
export function installSessionRefresh() {
  if (typeof window === 'undefined' || !window.fetch || window.fetch.__sessionRefresh) return;
  const innerFetch = window.fetch.bind(window);
  const refreshingFetch = async (input, init = {}) => {
    const response = await innerFetch(input, init);
    if (response?.status !== 401) return response;

    const url = requestUrl(input);
    if (!url || !isTracedUrl(url) || typeof init.body?.getReader === 'function') return response;
    const headers = new Headers(init.headers);
    const authorization = headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return response;

    const token = await untilAborted(freshToken(authorization.slice('Bearer '.length)), init.signal);
    if (!token) return response;
    headers.set('Authorization', `Bearer ${token}`);
    return innerFetch(input, { ...init, headers });
  };
  refreshingFetch.__sessionRefresh = true;
  window.fetch = refreshingFetch;
}
