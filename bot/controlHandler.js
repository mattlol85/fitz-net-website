import { getBotEntry, resetIdleTimer } from './botManager.js';

/**
 * Handle WebSocket messages for bot control
 * @param {WebSocket} ws - The WebSocket connection
 * @param {string} userId - The user ID
 * @param {Object} data - Parsed JSON message
 */
export function handleControlMessage(ws, userId, data) {
  const entry = getBotEntry(userId);
  if (!entry || entry.status !== 'online') {
    ws.send(JSON.stringify({ type: 'error', message: 'Bot is not online' }));
    return;
  }

  const bot = entry.bot;

  // Reset idle timer on any input
  resetIdleTimer(userId);

  switch (data.type) {
    case 'move':
      handleMove(bot, data);
      break;
    case 'look':
      handleLook(bot, data);
      break;
    case 'chat':
      handleChat(bot, data);
      break;
    case 'action':
      handleAction(bot, data);
      break;
    case 'jump':
      bot.setControlState('jump', data.state ?? true);
      break;
    case 'sneak':
      bot.setControlState('sneak', data.state ?? true);
      break;
    case 'sprint':
      bot.setControlState('sprint', data.state ?? true);
      break;
    case 'stop':
      // Stop all movement
      bot.clearControlStates();
      break;
    case 'status':
      // Send back current bot status
      ws.send(JSON.stringify({
        type: 'status',
        health: bot.health,
        food: bot.food,
        position: bot.entity?.position ? {
          x: Math.round(bot.entity.position.x * 100) / 100,
          y: Math.round(bot.entity.position.y * 100) / 100,
          z: Math.round(bot.entity.position.z * 100) / 100,
        } : null,
      }));
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown command: ${data.type}` }));
  }
}

function handleMove(bot, data) {
  const validDirections = ['forward', 'back', 'left', 'right'];
  if (validDirections.includes(data.direction)) {
    bot.setControlState(data.direction, data.state !== false);
  }
}

function handleLook(bot, data) {
  if (typeof data.yaw === 'number' && typeof data.pitch === 'number') {
    bot.look(data.yaw, data.pitch, data.force ?? false);
  }
}

function handleChat(bot, data) {
  if (data.message && typeof data.message === 'string') {
    bot.chat(data.message.slice(0, 256)); // Limit chat length
  }
}

function handleAction(bot, data) {
  switch (data.action) {
    case 'attack':
      bot.swingArm();
      break;
    case 'use':
      bot.activateItem();
      break;
    case 'deactivate':
      bot.deactivateItem();
      break;
    default:
      break;
  }
}

export default { handleControlMessage };

