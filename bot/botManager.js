import mineflayer from 'mineflayer';
  import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Map of userId -> { bot, viewerPort, status, idleTimer }
const bots = new Map();

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const BASE_VIEWER_PORT = 3007;

let nextViewerPort = BASE_VIEWER_PORT;

function getNextViewerPort() {
  return nextViewerPort++;
}

/**
 * Spawn a Mineflayer bot for a user
 * @param {string} userId - Unique user identifier
 * @param {string} username - Minecraft username for the bot
 * @param {string} serverHost - MC server hostname
 * @param {number} serverPort - MC server port
 * @returns {Promise<Object>} Bot info with viewerPort and wsPath
 */
export async function spawnBot(userId, username, serverHost, serverPort) {
  // Don't allow duplicate bots
  if (bots.has(userId)) {
    const existing = bots.get(userId);
    return {
      status: 'already_running',
      viewerPort: existing.viewerPort,
      username: existing.bot.username,
    };
  }

  const viewerPort = getNextViewerPort();
  const mcVersion = process.env.MC_VERSION || false; // false = auto-detect
  const mcAuth = (process.env.MC_AUTH || 'offline').toLowerCase();
  console.log(`Spawning bot for ${userId} - MC_VERSION=${mcVersion || 'auto-detect'} MC_AUTH=${mcAuth}`);

  return new Promise((resolve, reject) => {
    const botOptions = {
      host: serverHost,
      port: serverPort,
      username,
      auth: mcAuth,
      hideErrors: false,
    };

    // Pin to a specific MC version if configured (avoids auto-detect issues)
    if (mcVersion) {
      botOptions.version = mcVersion;
    }

    const bot = mineflayer.createBot(botOptions);

    const entry = {
      bot,
      viewerPort,
      status: 'connecting',
      idleTimer: null,
      wsClients: new Set(),
    };

    bot.once('spawn', async () => {
      console.log(`✅ Bot "${username}" spawned for user ${userId} on ${serverHost}:${serverPort}`);
      entry.status = 'online';

      // Start idle timer
      resetIdleTimer(userId);

      // Start viewer and wait until it's ready before responding to the client
      await startViewer(bot, viewerPort);

      resolve({
        status: 'online',
        viewerPort,
        username: bot.username,
      });
    });

    bot.once('error', (err) => {
      console.error(`❌ Bot error for user ${userId}:`, err.message);
      entry.status = 'error';
      bots.delete(userId);
      reject(err);
    });

    bot.once('end', (reason) => {
      console.log(`🔌 Bot "${username}" disconnected for user ${userId}: ${reason}`);
      cleanup(userId);
    });

    bot.once('kicked', (reason) => {
      console.log(`🚫 Bot "${username}" kicked for user ${userId}: ${reason}`);
      cleanup(userId);
    });

    // Relay chat to WebSocket clients
    bot.on('chat', (chatterUsername, message) => {
      const chatMsg = JSON.stringify({
        type: 'chat',
        username: chatterUsername,
        message,
        timestamp: Date.now(),
      });
      for (const ws of entry.wsClients) {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(chatMsg);
        }
      }
    });

    bots.set(userId, entry);
  });
}

/**
 * Poll until a local HTTP server is listening on `port`, or timeout.
 */
function waitForPort(port, retries = 30, delayMs = 200) {
  return new Promise((resolve) => {
    let attempts = 0;

    function check() {
      fetch(`http://localhost:${port}/`)
        .then(() => resolve(true))
        .catch(() => {
          if (++attempts >= retries) {
            resolve(false); // timed out — resolve false, don't reject
          } else {
            setTimeout(check, delayMs);
          }
        });
    }

    check();
  });
}

/**
 * Start prismarine-viewer for a bot. Returns a promise that resolves when
 * the viewer HTTP server is actually listening (or after a timeout).
 */
async function startViewer(bot, port) {
  try {
    const viewer = require('prismarine-viewer/lib/mineflayer');
    viewer(bot, { port, firstPerson: true });

    const ready = await waitForPort(port);
    if (ready) {
      console.log(`🎮 Viewer ready on http://localhost:${port}`);
    } else {
      console.warn(`⚠️ Viewer started but did not respond on port ${port} within timeout`);
    }
  } catch (err) {
    console.error('⚠️ Failed to start prismarine-viewer:', err.message);
  }
}

/**
 * Despawn a bot
 */
export function despawnBot(userId) {
  const entry = bots.get(userId);
  if (!entry) {
    return { status: 'not_found' };
  }

  try {
    entry.bot.quit();
  } catch (e) {
    // bot may already be disconnected
  }

  cleanup(userId);
  return { status: 'despawned' };
}

/**
 * Get bot status
 */
export function getBotStatus(userId) {
  const entry = bots.get(userId);
  if (!entry) {
    return { status: 'offline', viewerPort: null };
  }

  const bot = entry.bot;
  return {
    status: entry.status,
    viewerPort: entry.viewerPort,
    username: bot.username,
    health: bot.health,
    food: bot.food,
    position: bot.entity?.position ? {
      x: Math.round(bot.entity.position.x),
      y: Math.round(bot.entity.position.y),
      z: Math.round(bot.entity.position.z),
    } : null,
    players: Object.keys(bot.players || {}).length,
  };
}

/**
 * Get the bot entry (for WebSocket handler)
 */
export function getBotEntry(userId) {
  return bots.get(userId);
}

/**
 * Reset the idle timeout for a user's bot
 */
export function resetIdleTimer(userId) {
  const entry = bots.get(userId);
  if (!entry) return;

  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
  }

  entry.idleTimer = setTimeout(() => {
    console.log(`⏰ Idle timeout reached for user ${userId}, despawning bot`);
    despawnBot(userId);
  }, IDLE_TIMEOUT_MS);
}

/**
 * Cleanup a bot entry
 */
function cleanup(userId) {
  const entry = bots.get(userId);
  if (!entry) return;

  try {
    entry.bot.viewer?.close?.();
  } catch (err) {
    console.warn(`⚠️ Failed to close viewer for user ${userId}:`, err.message);
  }

  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
  }

  // Notify all WS clients
  for (const ws of entry.wsClients) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'bot_disconnected' }));
    }
  }

  bots.delete(userId);
}

export default { spawnBot, despawnBot, getBotStatus, getBotEntry, resetIdleTimer };



