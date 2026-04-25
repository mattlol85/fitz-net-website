// Minecraft bot service — REST calls to the bot server (proxied through Vite in dev)
const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || '/bot-api';
const BOT_API_KEY = import.meta.env.VITE_BOT_API_KEY || 'dev-api-key';
const BOT_WS_URL = import.meta.env.VITE_BOT_WS_URL || `ws://localhost:3002`;

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': BOT_API_KEY,
};

/**
 * Spawn a Minecraft bot for the current user
 */
export const spawnBot = async (userId, username) => {
  try {
    const response = await fetch(`${BOT_API_URL}/bot/spawn`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, username }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.error || 'Failed to spawn bot' };
    }
    return { success: true, ...data };
  } catch (error) {
    console.error('❌ Spawn bot error:', error);
    return { success: false, message: 'Network error. Is the bot server running?' };
  }
};

/**
 * Despawn the user's bot
 */
export const despawnBot = async (userId) => {
  try {
    const response = await fetch(`${BOT_API_URL}/bot/despawn`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
    });
    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    console.error('❌ Despawn bot error:', error);
    return { success: false, message: 'Network error.' };
  }
};

/**
 * Get bot status
 */
export const getBotStatus = async (userId) => {
  try {
    const response = await fetch(`${BOT_API_URL}/bot/status/${userId}`, {
      headers,
    });
    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    return { success: false, status: 'offline' };
  }
};

/**
 * Get the WebSocket URL for bot control
 */
export const getBotWsUrl = (userId) => {
  return `${BOT_WS_URL}/bot/ws?userId=${encodeURIComponent(userId)}`;
};

export default { spawnBot, despawnBot, getBotStatus, getBotWsUrl };


