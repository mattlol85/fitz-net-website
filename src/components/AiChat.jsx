import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage } from '../services/aiChatService';
import '../css/AiChat.css';

let nextId = 1;

export default function AiChat() {
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
  const cancelRef = useRef(null);
  const listRef = useRef(null);

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

    cancelRef.current = sendMessage(content, (partial, done) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: partial, done } : m))
      );
      if (done) setSending(false);
    });
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat__header">
        <h1>AI</h1>
        <span className="ai-chat__badge">Preview — not yet connected to a live model</span>
      </div>

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
