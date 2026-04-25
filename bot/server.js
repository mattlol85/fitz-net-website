import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import { spawnBot, despawnBot, getBotStatus, getBotEntry } from './botManager.js';
import { handleControlMessage } from './controlHandler.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
if (Number.isFinite(nodeMajor) && nodeMajor < 22) {
  console.error(`Mineflayer requires Node.js >= 22. Current: ${process.versions.node}`);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const PORT = process.env.BOT_SERVER_PORT || 3001;
const MC_HOST = process.env.MC_SERVER_HOST || 'localhost';
const MC_PORT = parseInt(process.env.MC_SERVER_PORT || '25565');
const API_KEY = process.env.BOT_API_KEY || 'dev-api-key';

const app = express();
app.use(cors());
app.use(express.json());

function withViewerUrl(botData) {
  if (!botData) return botData;

  // VITE_VIEWER_PROXY can be set to a base URL like http://localhost:3000/mc-viewer
  // so the frontend iframe goes through the Vite proxy instead of hitting the viewer port directly.
  // Falls back to direct localhost URL when not set.
  const viewerBase = process.env.VIEWER_PROXY_URL || null;

  return {
    ...botData,
    viewerUrl: botData.viewerPort
      ? viewerBase || `http://localhost:${botData.viewerPort}`
      : null,
  };
}

// Simple API key auth middleware
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// Health check (no auth)
app.get('/bot/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date().toISOString() });
});

// Spawn a bot
app.post('/bot/spawn', requireApiKey, async (req, res) => {
  const { userId, username } = req.body;

  if (!userId || !username) {
    return res.status(400).json({ error: 'userId and username are required' });
  }

  try {
    const result = await spawnBot(userId, username, MC_HOST, MC_PORT);
    res.json({
      ...withViewerUrl(result),
      wsUrl: `ws://localhost:${PORT}`,
    });
  } catch (err) {
    console.error('Spawn error:', err);
    res.status(500).json({
      error: 'Failed to spawn bot',
      message: err.message,
    });
  }
});

// Despawn a bot
app.post('/bot/despawn', requireApiKey, (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const result = despawnBot(userId);
  res.json(result);
});

// Get bot status
app.get('/bot/status/:userId', requireApiKey, (req, res) => {
  const { userId } = req.params;
  const status = withViewerUrl(getBotStatus(userId));
  res.json(status);
});

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// WebSocket server for bot control
const wss = new WebSocketServer({ server, path: '/bot/ws' });

wss.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the other bot server or change BOT_SERVER_PORT.`);
    process.exit(1);
  }
  console.error('❌ WebSocket server error:', err);
});

wss.on('connection', (ws, req) => {
  // Extract userId from query params: /bot/ws?userId=xxx
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    ws.send(JSON.stringify({ type: 'error', message: 'userId query param required' }));
    ws.close();
    return;
  }

  const entry = getBotEntry(userId);
  if (!entry) {
    ws.send(JSON.stringify({ type: 'error', message: 'No bot found for this user. Spawn one first.' }));
    ws.close();
    return;
  }

  // Register this WS client
  entry.wsClients.add(ws);
  console.log(`🔗 WebSocket connected for user ${userId}`);

  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to bot control',
    botStatus: withViewerUrl(getBotStatus(userId)),
  }));

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      handleControlMessage(ws, userId, data);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    entry.wsClients.delete(ws);
    console.log(`🔌 WebSocket disconnected for user ${userId}`);
  });
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the other bot server or change BOT_SERVER_PORT.`);
    process.exit(1);
  }
  console.error('❌ HTTP server error:', err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\nBot Server running on port ${PORT}`);
  console.log(`   MC Server: ${MC_HOST}:${MC_PORT}`);
  console.log(`   MC Version: ${process.env.MC_VERSION || 'auto-detect'}`);
  console.log(`   MC Auth: ${process.env.MC_AUTH || 'offline'}`);
  console.log(`   Health: http://localhost:${PORT}/bot/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}/bot/ws\n`);
});



