/**
 * AI Chat service.
 *
 * Two modes:
 * - sendMessage(): mock mode, used when no node is selected. Canned
 *   responses with a simulated "thinking" delay and a char-by-char reveal.
 * - sendMessageToNode(): real mode, routes through fitz-net-api to a
 *   specific node's Ollama instance (POST /node/{id}/chat). The backend
 *   call is non-streaming (returns the full reply at once), so the real
 *   reply is fed through the same char-by-char reveal as the mock path,
 *   keeping the typing UX identical either way.
 */
import { chatWithNode } from './nodeService';

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
  let cancelled = false;
  let i = 0;
  const intervalId = setInterval(() => {
    if (cancelled) {
      clearInterval(intervalId);
      return;
    }
    i += Math.max(1, Math.round(text.length / 60));
    const done = i >= text.length;
    onToken(text.slice(0, i), done);
    if (done) clearInterval(intervalId);
  }, 20);

  return () => {
    cancelled = true;
    clearInterval(intervalId);
  };
}

/**
 * Simulates sending a message and streaming back a mock reply.
 * @param {string} content - the user's message
 * @param {(partial: string, done: boolean) => void} onToken - called as each chunk of the reply arrives
 * @returns {() => void} cancel function
 */
export function sendMessage(content, onToken) {
  let cancelled = false;
  let stopReveal = null;
  const reply = nextReply();

  const thinkingDelay = 500 + Math.random() * 500;
  const revealTimer = setTimeout(() => {
    if (cancelled) return;
    stopReveal = revealText(reply, onToken);
  }, thinkingDelay);

  return () => {
    cancelled = true;
    clearTimeout(revealTimer);
    stopReveal?.();
  };
}

/**
 * Sends a real prompt to a node's Ollama instance via fitz-net-api, then
 * reveals the reply the same way sendMessage() does for mock replies.
 * @param {string} nodeId
 * @param {string} model
 * @param {string} content - the user's message
 * @param {string} authToken - the caller's JWT
 * @param {(partial: string, done: boolean) => void} onToken
 * @returns {() => void} cancel function
 */
export function sendMessageToNode(nodeId, model, content, authToken, onToken) {
  let cancelled = false;
  let stopReveal = null;

  chatWithNode(nodeId, content, model, authToken)
    .then((res) => {
      if (cancelled) return;
      stopReveal = revealText(res.reply || '', onToken);
    })
    .catch((err) => {
      if (cancelled) return;
      onToken(`⚠️ ${err.message}`, true);
    });

  return () => {
    cancelled = true;
    stopReveal?.();
  };
}
