import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMinecraftBot } from '../hooks/useMinecraftBot';
import MinecraftViewer from './MinecraftViewer.jsx';
import MinecraftControls from './MinecraftControls.jsx';
import MinecraftChat from './MinecraftChat.jsx';
import '../css/VideoGames.css';

function VideoGames() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const userId = user?.username || '';
  const {
    botStatus,
    botInfo,
    chatMessages,
    error,
    spawn,
    despawn,
    sendControl,
    sendChat,
  } = useMinecraftBot(userId, user?.username);

  if (authLoading) {
    return (
      <div className="videogames-container">
        <div className="videogames-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const isOnline = botStatus === 'online';
  const isConnecting = botStatus === 'connecting';

  return (
    <div className="videogames-container">
      <div className="videogames-header">
        <h1>🎮 Video Games</h1>
        <p className="videogames-subtitle">
          Control a Minecraft bot from your browser
        </p>
      </div>

      {/* Status & Controls Bar */}
      <div className="videogames-toolbar">
        <div className="bot-status-section">
          <span className={`bot-status-dot ${botStatus}`}></span>
          <span className="bot-status-text">
            {botStatus === 'offline' && 'Bot Offline'}
            {botStatus === 'connecting' && 'Connecting...'}
            {botStatus === 'online' && `Bot Online — ${botInfo?.username || userId}`}
            {botStatus === 'error' && 'Error'}
          </span>
        </div>

        <div className="bot-actions">
          {!isOnline && !isConnecting && (
            <button className="spawn-button" onClick={spawn}>
              ▶ Spawn Bot
            </button>
          )}
          {isConnecting && (
            <button className="spawn-button" disabled>
              Spawning...
            </button>
          )}
          {isOnline && (
            <button className="despawn-button" onClick={despawn}>
              ■ Despawn
            </button>
          )}
        </div>

        {botInfo?.position && (
          <div className="bot-position">
            📍 {botInfo.position.x}, {botInfo.position.y}, {botInfo.position.z}
          </div>
        )}

        {botInfo?.health != null && (
          <div className="bot-vitals">
            ❤️ {Math.round(botInfo.health)} | 🍗 {Math.round(botInfo.food)}
          </div>
        )}
      </div>

      {error && <div className="videogames-error">{error}</div>}

      {/* Main content area */}
      {isOnline ? (
        <div className="videogames-main">
          <div className="viewer-panel">
            <MinecraftViewer viewerUrl={botInfo?.viewerUrl} />
            <MinecraftControls sendControl={sendControl} isOnline={isOnline} />
          </div>
          <div className="chat-panel">
            <MinecraftChat
              messages={chatMessages}
              onSend={sendChat}
              isOnline={isOnline}
            />
          </div>
        </div>
      ) : (
        <div className="videogames-placeholder">
          <div className="placeholder-content">
            <span className="placeholder-icon">🎮</span>
            <h2>Ready to Play?</h2>
            <p>
              Click <strong>Spawn Bot</strong> to create a Minecraft character
              that you can control from right here in your browser.
            </p>
            <p className="placeholder-note">
              Make sure a Minecraft server is running on the configured address.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoGames;


