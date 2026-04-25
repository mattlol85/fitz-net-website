import React, { useState, useRef, useEffect } from 'react';

function MinecraftChat({ messages, onSend, isOnline }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || !isOnline) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="mc-chat">
      <div className="mc-chat-header">💬 Minecraft Chat</div>
      <div className="mc-chat-messages">
        {messages.length === 0 && (
          <div className="mc-chat-empty">No messages yet...</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="mc-chat-msg">
            <span className="mc-chat-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="mc-chat-username">&lt;{msg.username}&gt;</span>
            <span className="mc-chat-text">{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="mc-chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isOnline ? 'Type a message...' : 'Bot offline'}
          disabled={!isOnline}
          maxLength={256}
        />
        <button type="submit" disabled={!isOnline || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default MinecraftChat;

