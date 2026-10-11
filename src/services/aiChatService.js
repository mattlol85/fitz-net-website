/**
 * AI Chat service.
 *
 * Two modes:
 * - sendMessage(): mock mode, used when no node is selected. Canned
 *   responses with a simulated "thinking" delay and a char-by-char reveal.
 * - sendMessageToNode(): real mode, streams a reply from a specific node's
 *   Ollama instance through fitz-net-api (POST /node/{id}/chat/stream).
 *   Tokens are shown as they arrive, so slow generations don't hit proxy
 *   timeouts (Fitz-Net#65).
 */
import { streamChatWithNode } from './nodeService';

const MOCK_REPLIES = [
  "I'm just a preview right now — no local model is connected yet. Once Fitz-Net nodes come online, I'll route this to one of them.",
  "That's a good question! When this is wired up, a worker node (local GPU or a remote one over the private network) will actually answer it.",
  "Still a placeholder here. Check the Status tab to see which AI nodes are online — that's where real requests will eventually be routed.",
  "Noted. For now I can only echo canned responses, but the chat UI itself is the real deal — just waiting on a model behind it.",
];

let replyIndex = 0;

function nextReply() {
  const reply = MOCK_REPLIES[replyIndex % MOCK_REPLIES.length];
  replyIndex += 1;
  return reply;
}

/**
 * Reveals `text` to `onToken` a few characters at a time, as if it were
 * streaming in. Returns a cancel function.
 */
function revealText(text, onToken) {
  let i = 0;
  const intervalId = setInterval(() => {
    i += Math.max(1, Math.round(text.length / 60));
    const done = i >= text.length;
    onToken(text.slice(0, i), done);
    if (done) clearInterval(intervalId);
  }, 20);

  return () => clearInterval(intervalId);
}

/**
 * Simulates sending a message and streaming back a mock reply.
 * @param {string} content - the user's message
 * @param {(partial: string, done: boolean) => void} onToken - called as each chunk of the reply arrives
 * @returns {() => void} cancel function
 */
export function sendMessage(content, onToken) {
  let stopReveal = null;
  const reply = nextReply();

  const thinkingDelay = 500 + Math.random() * 500;
  const revealTimer = setTimeout(() => {
    stopReveal = revealText(reply, onToken);
  }, thinkingDelay);

  return () => {
    clearTimeout(revealTimer);
    stopReveal?.();
  };
}

/**
 * Streams a real reply from a node's Ollama instance via fitz-net-api.
 * Cancelling aborts the request, which stops generation on the node.
 * @param {string} nodeId
 * @param {string} model
 * @param {Array<{role: string, content: string}>} messages - full history ending with the new user turn
 * @param {string} authToken - the caller's JWT
 * @param {(partial: string, done: boolean) => void} onToken
 * @param {{onMeta?: Function, onDone?: Function}} [handlers] - stream metadata / final token usage
 * @returns {() => void} cancel function
 */
export function sendMessageToNode(nodeId, model, messages, authToken, onToken, handlers = {}) {
  const controller = new AbortController();
  let reply = '';

  streamChatWithNode(nodeId, messages, model, authToken, {
    signal: controller.signal,
    onMeta: handlers.onMeta,
    onDone: handlers.onDone,
    onToken: (chunk) => {
      reply += chunk;
      onToken(reply, false);
    },
  })
    .then((full) => {
      if (controller.signal.aborted) return;
      onToken(full, true);
    })
    .catch((err) => {
      if (controller.signal.aborted) return;
      onToken(reply ? `${reply}\n\n⚠️ ${err.message}` : `⚠️ ${err.message}`, true);
    });

  return () => controller.abort();
}
