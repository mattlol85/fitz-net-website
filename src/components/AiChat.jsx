import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage, sendMessageToNode } from '../services/aiChatService';
import { fetchNodes } from '../services/nodeService';
import { useAuth } from '../contexts/AuthContext';
import '../css/AiChat.css';

let nextId = 1;

export default function AiChat() {
  const { token: authToken, isAuthenticated } = useAuth();
  const authed = isAuthenticated();

  const [messages, setMessages] = useState([
    {
      id: nextId++,
      role: 'assistant',
      content: "Hi! This is a preview of the Fitz-Net AI chat — nothing is connected to a real model yet, but ask away.",
      done: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
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

  const handleSend = (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { id: nextId++, role: 'user', content, done: true }]);

    const assistantId = nextId++;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', done: false }]);

    const onToken = (partial, done) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: partial, done } : m))
      );
      if (done) setSending(false);
    };

    cancelRef.current = selectedNode
      ? sendMessageToNode(selectedNode.id, selectedModel, content, authToken, onToken)
      : sendMessage(content, onToken);
  };

  const badge = selectedNode
    ? `Connected to ${selectedNode.name} (${selectedModel})`
    : 'Preview — not yet connected to a live model';

  return (
    <div className="ai-chat">
      <div className="ai-chat__header">
        <h1>AI</h1>
        <span className="ai-chat__badge">{badge}</span>
      </div>

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

      <div className="ai-chat__messages" ref={listRef} data-testid="ai-chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`ai-chat__message ai-chat__message--${m.role}`}>
            <span className="ai-chat__message-author">{m.role === 'user' ? 'You' : 'Fitz-Net AI'}</span>
            <div className="ai-chat__message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                }}
              >
                {m.content || (m.done ? '' : '…')}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      <form className="ai-chat__input-row" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something…"
          aria-label="Message"
        />
        <button type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
