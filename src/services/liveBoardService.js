/**
 * Live Board STOMP WebSocket service.
 * Call init(token) from within a React component that has the auth token.
 *
 * In mock mode (VITE_USE_MOCK_API=true) the service emits fake board events
 * locally without connecting to a server.
 */
import { Client } from '@stomp/stompjs';

export const FADE_DURATION_MS = 86_400_000; // 24 hours

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

let stompClient = null;
let stompSubs = {};
const _handlers = {};

function _emit(event, data) {
  (_handlers[event] || []).forEach(cb => {
    try { cb(data); } catch (e) { console.error('liveBoardService handler error', e); }
  });
}

function _subscribe(event, cb) {
  if (!_handlers[event]) _handlers[event] = [];
  _handlers[event].push(cb);
  return () => { _handlers[event] = (_handlers[event] || []).filter(h => h !== cb); };
}

function buildWsUrl() {
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase && apiBase.startsWith('http')) {
    return apiBase.replace(/^http/, 'ws') + '/ws-board';
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws-board`;
}

// ── Mock ──────────────────────────────────────────────────────────────────────
let mockActive = false;
let mockToken = null;

function _decodeMockUsername(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || 'you';
  } catch (_) {
    return 'you';
  }
}

function mockInit(token) {
  mockToken = token || null;
  if (mockActive) return;
  mockActive = true;
  setTimeout(() => _emit('cursors', { username: 'ghost_user', xRatio: 0.38, yRatio: 0.42, color: 'hsl(160,72%,50%)', painting: false }), 600);
  setTimeout(() => _emit('messages', {
    id: 'mock-1', username: 'ghost_user', xRatio: 0.38, yRatio: 0.47,
    content: '**Mock mode** — Live Board without a backend.\n\nTry [fitznet.org](https://fitznet.org)',
    postedAt: new Date().toISOString(),
  }), 1200);
}

function mockSendMessage(xRatio, yRatio, content) {
  const username = mockToken ? _decodeMockUsername(mockToken) : 'you';
  _emit('messages', {
    id: `mock-${Date.now()}`,
    username,
    xRatio,
    yRatio,
    content,
    postedAt: new Date().toISOString(),
  });
}

function mockDisconnect() { mockActive = false; mockToken = null; }

// ── Real STOMP ────────────────────────────────────────────────────────────────
function realInit(token) {
  if (stompClient?.active) return;
  stompClient = new Client({
    brokerURL: buildWsUrl(),
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 5000,
    onConnect: () => {
      stompSubs.cursors      = stompClient.subscribe('/topic/board/cursors',      (m) => _emit('cursors',      JSON.parse(m.body)));
      stompSubs.messages     = stompClient.subscribe('/topic/board/messages',     (m) => _emit('messages',     JSON.parse(m.body)));
      stompSubs.cursorRemove = stompClient.subscribe('/topic/board/cursor-remove',(m) => _emit('cursorRemove', JSON.parse(m.body)));
      stompSubs.cleared      = stompClient.subscribe('/topic/board/cleared',      ()  => _emit('cleared',      null));
      stompSubs.typing       = stompClient.subscribe('/topic/board/typing',       (m) => _emit('typing',       JSON.parse(m.body)));
      stompSubs.joinReply    = stompClient.subscribe('/app/board/join',           (m) => _emit('boardState',   JSON.parse(m.body)));
    },
    onStompError: (frame) => console.error('[LiveBoard] STOMP error:', frame),
  });
  stompClient.activate();
}

function realDisconnect() {
  Object.values(stompSubs).forEach(sub => { try { sub.unsubscribe(); } catch (_) {} });
  stompSubs = {};
  stompClient?.deactivate();
  stompClient = null;
}

function realSendCursor(xRatio, yRatio, painting = false, color = '') {
  if (!stompClient?.active) return;
  stompClient.publish({ destination: '/app/board/cursor', body: JSON.stringify({ xRatio, yRatio, painting, color }) });
}

function realSendMessage(xRatio, yRatio, content) {
  if (!stompClient?.active) return;
  stompClient.publish({ destination: '/app/board/message', body: JSON.stringify({ xRatio, yRatio, content }) });
}

function realSendTyping(xRatio, yRatio, typing) {
  if (!stompClient?.active) return;
  stompClient.publish({ destination: '/app/board/typing', body: JSON.stringify({ xRatio, yRatio, typing }) });
}

// ── Mock typing ──────────────────────────────────────────────────────────────
function mockSendTyping(xRatio, yRatio, typing) {
  // Echo a ghost typist so mock mode can exercise the indicator UI.
  if (!typing) { _emit('typing', { username: 'ghost_user', typing: false }); return; }
  _emit('typing', { username: 'ghost_user', xRatio: 0.62, yRatio: 0.3, typing: true });
}

// ── Public API ────────────────────────────────────────────────────────────────
export function init(token)                    { USE_MOCK ? mockInit(token)                        : realInit(token); }
export function disconnect()                   { USE_MOCK ? mockDisconnect()                        : realDisconnect(); }
// In mock mode, sendCursor is intentionally a no-op: the real backend broadcasts
// cursors to all OTHER subscribers, so the own user's cursor is always filtered by
// subscribeCursors anyway. Showing own paint trails locally would require a separate
// render path and is not part of the current feature scope.
export function sendCursor(xRatio, yRatio, painting = false, color = '') { if (!USE_MOCK) realSendCursor(xRatio, yRatio, painting, color); }
export function sendMessage(xRatio, yRatio, c) { USE_MOCK ? mockSendMessage(xRatio, yRatio, c)      : realSendMessage(xRatio, yRatio, c); }
export function sendTyping(xRatio, yRatio, typing) { USE_MOCK ? mockSendTyping(xRatio, yRatio, typing) : realSendTyping(xRatio, yRatio, typing); }

export const subscribeCursors      = (cb) => _subscribe('cursors', cb);
export const subscribeTyping       = (cb) => _subscribe('typing', cb);
export const subscribeMessages     = (cb) => _subscribe('messages', cb);
export const subscribeCursorRemove = (cb) => _subscribe('cursorRemove', cb);
export const subscribeCleared      = (cb) => _subscribe('cleared', cb);
export const subscribeBoardState   = (cb) => _subscribe('boardState', cb);


