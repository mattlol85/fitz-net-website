/**
 * AI Chat service — Phase 1 preview.
 *
 * There is no live model wired up yet, so this always runs in mock mode:
 * it returns canned responses with a simulated "thinking" delay and a
 * char-by-char reveal, previewing what streaming will feel like once a
 * real backend (Fitz-Net node delegate) is connected. Swapping in a real
 * call later only touches sendMessage()/the reveal loop below.
 */

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
 * Simulates sending a message and streaming back a reply.
 * @param {string} content - the user's message
 * @param {(partial: string, done: boolean) => void} onToken - called as each chunk of the reply arrives
 * @returns {() => void} cancel function
 */
export function sendMessage(content, onToken) {
  let cancelled = false;
  const reply = nextReply();

  const thinkingDelay = 500 + Math.random() * 500;
  const revealTimer = setTimeout(() => {
    if (cancelled) return;
    let i = 0;
    const intervalId = setInterval(() => {
      if (cancelled) {
        clearInterval(intervalId);
        return;
      }
      i += Math.max(1, Math.round(reply.length / 60));
      const done = i >= reply.length;
      onToken(reply.slice(0, i), done);
      if (done) clearInterval(intervalId);
    }, 20);
  }, thinkingDelay);

  return () => {
    cancelled = true;
    clearTimeout(revealTimer);
  };
}
