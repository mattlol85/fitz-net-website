import { useState, useEffect, useRef, useCallback } from 'react';
import { spawnBot, despawnBot, getBotStatus, getBotWsUrl } from '../services/minecraftService';

/**
 * Custom hook for managing a Minecraft bot connection
 */
export function useMinecraftBot(userId, username) {
  const [botStatus, setBotStatus] = useState('offline'); // offline | connecting | online | error
  const [botInfo, setBotInfo] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
    };
  }, []);

  const connectWebSocket = useCallback((uid) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = getBotWsUrl(uid);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🔗 Bot WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            setBotInfo((prev) => ({ ...prev, ...data.botStatus }));
            break;
          case 'chat':
            setChatMessages((prev) => [...prev.slice(-99), {
              username: data.username,
              message: data.message,
              timestamp: data.timestamp,
            }]);
            break;
          case 'status':
            setBotInfo((prev) => ({ ...prev, ...data }));
            break;
          case 'bot_disconnected':
            setBotStatus('offline');
            setBotInfo(null);
            break;
          case 'error':
            console.error('Bot WS error:', data.message);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse bot WS message:', err);
      }
    };

    ws.onclose = () => {
      console.log('🔌 Bot WebSocket disconnected');
    };

    ws.onerror = (err) => {
      console.error('Bot WebSocket error:', err);
    };
  }, []);

  const spawn = useCallback(async () => {
    if (!userId || !username) return;

    setError(null);
    setBotStatus('connecting');
    setChatMessages([]);

    const result = await spawnBot(userId, username);

    if (result.success || result.status === 'already_running') {
      setBotStatus('online');
      setBotInfo(result);
      connectWebSocket(userId);
    } else {
      setBotStatus('error');
      setError(result.message);
    }
  }, [userId, username, connectWebSocket]);

  const despawn = useCallback(async () => {
    if (!userId) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    await despawnBot(userId);
    setBotStatus('offline');
    setBotInfo(null);
  }, [userId]);

  const sendControl = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendChat = useCallback((message) => {
    sendControl({ type: 'chat', message });
    // Add our own message to the chat list
    setChatMessages((prev) => [...prev.slice(-99), {
      username: `${username} (you)`,
      message,
      timestamp: Date.now(),
    }]);
  }, [sendControl, username]);

  const refreshStatus = useCallback(async () => {
    if (!userId) return;
    const result = await getBotStatus(userId);
    if (result.success && result.status !== 'offline') {
      setBotStatus(result.status);
      setBotInfo(result);
    } else {
      setBotStatus('offline');
    }
  }, [userId]);

  return {
    botStatus,
    botInfo,
    chatMessages,
    error,
    spawn,
    despawn,
    sendControl,
    sendChat,
    refreshStatus,
  };
}

export default useMinecraftBot;

