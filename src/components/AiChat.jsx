import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage, sendMessageToNode } from '../services/aiChatService';
import { fetchNodes } from '../services/nodeService';
import { useAuth } from '../contexts/AuthContext';
import ContextRing, { contextLevel } from './ContextRing';
import '../css/AiChat.css';

let nextId = 1;

const GREETING = "Hi, I'm Matt-GPT — nothing's connected to a real model yet, but ask away.";

const makeGreeting = () => ({ id: nextId++, role: 'assistant', content: GREETING, done: true, greeting: true });

export function formatElapsed(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** The conversation to replay to the model: real turns only, no greeting or failed replies. */
function toHistory(messages) {
  return messages
    .filter((m) => !m.greeting && m.done && m.content && !m.content.startsWith('⚠️'))
    .map((m) => ({ role: m.role, content: m.content }));
}

export default function AiChat() {
  const { token: authToken, isAuthenticated } = useAuth();
  const authed = isAuthenticated();

  const [messages, setMessages] = useState(() => [makeGreeting()]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [usage, setUsage] = useState({ used: 0, max: 0 });
  const cancelRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!authed) return undefined;

    let cancelled = false;
    const load = async () => {
      try {
        const list = await fetchNodes();
        if (!cancelled) {
          setNodes(list.filter((n) => n.status === 'ONLINE'));
        }
      } catch {
        // Node list is a nice-to-have here; leave the selector empty on failure.
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authed]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  useEffect(() => {
    if (selectedNode && !selectedNode.models?.includes(selectedModel)) {
      setSelectedModel(selectedNode.models?.[0] || '');
    }
    if (!selectedNode) {
      setSelectedModel('');
    }
  }, [selectedNode, selectedModel]);

  useEffect(() => {
    const list = listRef.current;
    if (typeof list?.scrollTo === 'function') {
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => () => cancelRef.current?.(), []);

  const handleNewChat = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setSending(false);
    setMessages([makeGreeting()]);
    setUsage({ used: 0, max: 0 });
  };

  // A different model has a different window (and the new one hasn't seen this
  // conversation's cache), so the gauge restarts when the target changes.
  useEffect(() => {
    setUsage({ used: 0, max: 0 });
  }, [selectedNodeId, selectedModel]);

  const handleSend = (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    const history = [...toHistory(messages), { role: 'user', content }];
    const startedAt = performance.now();

    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { id: nextId++, role: 'user', content, done: true }]);

    const assistantId = nextId++;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', done: false }]);

    const onToken = (partial, done) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: partial, done, ...(done && { elapsedMs: performance.now() - startedAt }) }
            : m
        )
      );
      if (done) setSending(false);
    };

    cancelRef.current = selectedNode
      ? sendMessageToNode(selectedNode.id, selectedModel, history, authToken, onToken, {
          onMeta: (meta) => setUsage((u) => ({ ...u, max: meta.contextLength || u.max })),
          onDone: (d) =>
            setUsage({
              used: (d.promptTokens || 0) + (d.completionTokens || 0),
              max: d.contextLength || 0,
            }),
        })
      : sendMessage(content, onToken);
  };

  const badge = selectedNode
    ? `Connected to ${selectedNode.name} (${selectedModel})`
    : 'Preview — not yet connected to a live model';

  return (
    <div className="ai-chat">
      <div className="ai-chat__header">
        <h1>Matt-GPT</h1>
        <span className="ai-chat__badge">{badge}</span>

        {selectedNode && usage.max > 0 && <ContextRing used={usage.used} max={usage.max} />}
        {messages.some((m) => !m.greeting) && (
          <button type="button" className="ai-chat__new-chat" onClick={handleNewChat}>
            New chat
          </button>
        )}

        {authed && nodes.length > 0 && (
          <div className="ai-chat__node-picker">
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              aria-label="Node"
            >
              <option value="">Preview (no node)</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            {selectedNode && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                aria-label="Model"
              >
                {(selectedNode.models || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <div className="ai-chat__messages" ref={listRef} data-testid="ai-chat-messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`ai-chat__message ai-chat__message--${m.role}`}
            aria-label={m.role === 'user' ? 'You' : 'Matt-GPT'}
          >
            {m.role === 'assistant' && (
              <div className="ai-chat__avatar" aria-hidden="true">M</div>
            )}
            <div className="ai-chat__bubble">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                }}
              >
                {m.content || (m.done ? '' : '…')}
              </ReactMarkdown>
              {m.role === 'assistant' && m.elapsedMs != null && (
                <div className="ai-chat__elapsed" data-testid="elapsed">
                  {formatElapsed(m.elapsedMs)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedNode && usage.max > 0 && contextLevel(usage.used / usage.max) === 'danger' && (
        <p className="ai-chat__full-hint" role="status">
          Context nearly full — start a new chat to keep replies accurate.
        </p>
      )}

      <form className="ai-chat__input-row" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Matt-GPT…"
          aria-label="Message"
        />
        <button type="submit" disabled={sending || !input.trim()} aria-label="Send">
          ↑
        </button>
      </form>
    </div>
  );
}
