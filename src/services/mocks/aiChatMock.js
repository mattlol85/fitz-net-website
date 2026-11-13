/**
 * In-memory stand-in for fitz-net-api's `/ai/**` endpoints (docs/ai-chat-contract.md), used when
 * VITE_USE_MOCK_API=true so the whole chat is clickable without a backend. aiChatApi.js loads it
 * with a dynamic import() and never touches it otherwise.
 *
 * Nodes: Matt-PC (ONLINE, llama3.1:8b loaded, plus a vision and a thinking model), Rig-2 (ONLINE,
 * same models, nothing loaded) and Garage-Laptop (OFFLINE). Sending while Garage-Laptop is the
 * target ends the turn with NODE_OFFLINE and alternatives (a seeded conversation does exactly
 * that). A message starting with `/fail` fails mid-reply with NODE_UNREACHABLE.
 */
import { ApiError } from '../aiChatApi';
import { abortError } from '../sse';

export const mockConfig = {
  latencyMs: 120,
  tokenDelayMs: 30,
  thinkDelayMs: 350,
  loadDelayMs: 1500,
};

/** Overrides the simulated timings (tests set everything to 0). */
export function configureMock(partial) {
  Object.assign(mockConfig, partial);
}

const ids = { next: 1 };
const newId = () => (0x6a0000000000 + ids.next++).toString(16).padStart(24, '0');
const nowIso = () => new Date().toISOString();
const clone = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** Resolves after `ms`, or rejects with an AbortError as soon as `signal` aborts. */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// --- Fake nodes and models ---------------------------------------------------------------------

const MODEL_DETAILS = {
  'llama3.1:8b': {
    family: 'llama', parameterSize: '8.0B', quantization: 'Q4_K_M', sizeBytes: 4920753328,
    contextLength: 8192, maxContextLength: 131072, capabilities: ['completion'], vramMb: 5300,
  },
  'qwen3:14b': {
    family: 'qwen3', parameterSize: '14.8B', quantization: 'Q4_K_M', sizeBytes: 9276198565,
    contextLength: 16384, maxContextLength: 40960, capabilities: ['completion', 'thinking'], vramMb: 10200,
  },
  'llama3.2-vision:11b': {
    family: 'mllama', parameterSize: '10.7B', quantization: 'Q4_K_M', sizeBytes: 7816589186,
    contextLength: 8192, maxContextLength: 131072, capabilities: ['completion', 'vision'], vramMb: 9100,
  },
  'phi3:mini': {
    family: 'phi3', parameterSize: '3.8B', quantization: 'Q4_0', sizeBytes: 2176178913,
    // A deliberately tiny window so that trimming (and Summarise) is reachable in a few turns.
    contextLength: 1024, maxContextLength: 4096, capabilities: ['completion'], vramMb: 2800,
  },
};

function freshNodes() {
  return [
    {
      id: 'mock-node-garage', name: 'Garage-Laptop', status: 'OFFLINE', os: 'Ubuntu 24.04',
      lastHeartbeatAt: new Date(Date.now() - 3 * 3600_000).toISOString(), activeGenerations: 0,
      catalogStale: true, vram: { totalMb: 8192, usedMb: null, source: null },
      installed: ['llama3.1:8b', 'phi3:mini'], loaded: [],
    },
    {
      id: 'mock-node-mattpc', name: 'Matt-PC', status: 'ONLINE', os: 'Windows 11',
      lastHeartbeatAt: nowIso(), activeGenerations: 0, catalogStale: false,
      vram: { totalMb: 16384, usedMb: 9216, source: 'heartbeat' },
      installed: ['llama3.1:8b', 'qwen3:14b', 'llama3.2-vision:11b'], loaded: ['llama3.1:8b'],
    },
    {
      id: 'mock-node-rig2', name: 'Rig-2', status: 'ONLINE', os: 'Ubuntu 24.04',
      lastHeartbeatAt: nowIso(), activeGenerations: 0, catalogStale: false,
      vram: { totalMb: 24576, usedMb: 1100, source: 'ollama' },
      installed: ['llama3.1:8b', 'qwen3:14b', 'phi3:mini'], loaded: [],
    },
  ];
}

const isOffline = (node) => node.status === 'OFFLINE';

function nodeModel(node, name) {
  const loaded = node.loaded.includes(name);
  const d = MODEL_DETAILS[name];
  return {
    name,
    family: d.family,
    parameterSize: d.parameterSize,
    quantization: d.quantization,
    sizeBytes: d.sizeBytes,
    contextLength: d.contextLength,
    maxContextLength: d.maxContextLength,
    capabilities: [...d.capabilities],
    loaded,
    loadedUntil: loaded ? new Date(Date.now() + 25 * 60_000).toISOString() : null,
    vramMb: loaded ? d.vramMb : null,
  };
}

/** Nodes (not OFFLINE) that have the model, warm ones first, then the least busy. */
function candidates(state, model, excludeIds = []) {
  return state.nodes
    .filter((n) => !isOffline(n) && n.installed.includes(model) && !excludeIds.includes(n.id))
    .sort(
      (a, b) =>
        Number(b.loaded.includes(model)) - Number(a.loaded.includes(model)) ||
        a.activeGenerations - b.activeGenerations ||
        a.name.localeCompare(b.name)
    );
}

function buildCatalogue(state) {
  const nodes = state.nodes
    .map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      os: n.os,
      lastHeartbeatAt: n.lastHeartbeatAt,
      activeGenerations: n.activeGenerations,
      catalogStale: n.catalogStale,
      vram: n.vram,
      models: n.installed.map((name) => nodeModel(n, name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const names = [...new Set(state.nodes.filter((n) => !isOffline(n)).flatMap((n) => n.installed))].sort();
  const models = names.map((name) => {
    const available = candidates(state, name);
    const auto = available[0];
    const d = nodeModel(auto, name);
    return {
      name,
      nodeIds: available.map((n) => n.id),
      loadedOn: available.filter((n) => n.loaded.includes(name)).map((n) => n.id),
      autoNodeId: auto.id,
      parameterSize: d.parameterSize,
      quantization: d.quantization,
      contextLength: d.contextLength,
      capabilities: d.capabilities,
    };
  });

  return { generatedAt: nowIso(), nodes, models };
}

function alternativesFor(state, model, excludeId) {
  return candidates(state, model, [excludeId]).map((n) => ({
    nodeId: n.id,
    nodeName: n.name,
    model,
    loaded: n.loaded.includes(model),
    status: n.status,
  }));
}

// --- In-memory store ---------------------------------------------------------------------------

function seedConversation(state, { title, pinned = false, target, minutesAgo, exchanges }) {
  const createdAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const conv = {
    id: newId(), title, titleSource: 'auto', pinned, target,
    settings: { presetId: null, systemPrompt: null }, summary: null, messages: [],
    createdAt, updatedAt: createdAt,
  };
  exchanges.forEach(([question, answer]) => {
    appendMessage(conv, { role: 'user', content: question, createdAt });
    appendMessage(conv, {
      role: 'assistant', content: answer, createdAt,
      generation: generationFor(state, target, { auto: !target?.nodeId, promptTokens: 120, completionTokens: 80 }),
    });
  });
  state.conversations.set(conv.id, conv);
}

function freshState() {
  const state = {
    nodes: freshNodes(),
    conversations: new Map(),
    presets: new Map(),
    attachments: new Map(),
    preferences: { lastTarget: { model: 'llama3.1:8b', nodeId: null }, lastPresetId: null, updatedAt: nowIso() },
    inFlight: new Set(),
  };

  seedConversation(state, {
    title: 'Tuning the bell debounce', pinned: true,
    target: { model: 'llama3.1:8b', nodeId: null }, minutesAgo: 90,
    exchanges: [[
      'How long should I debounce the ESP32 bell button?',
      'Around **20-50 ms** is usual for a mechanical switch.\n\n- Sample on a timer rather than in the ISR\n- Require the level to be stable for 3 reads\n\n```cpp\nif (millis() - lastChange > 30) { state = reading; }\n```',
    ]],
  });
  seedConversation(state, {
    title: 'Garage laptop test (node offline)',
    target: { model: 'llama3.1:8b', nodeId: 'mock-node-garage' }, minutesAgo: 600,
    exchanges: [['Are you there?', 'Yes, I was running on the garage laptop back then.']],
  });
  seedConversation(state, {
    title: 'Long design discussion',
    target: { model: 'llama3.1:8b', nodeId: null }, minutesAgo: 240,
    exchanges: Array.from({ length: 8 }, (_, i) => [
      `Design question ${i + 1}: how should we structure part ${i + 1} of the bell firmware?`,
      `Answer ${i + 1}: ${'Split it into small, testable modules, keep the interrupt handlers tiny and move work to the main loop. '.repeat(4)}`,
    ]),
  });
  return state;
}

let state = freshState();

/** Drops all in-memory data and goes back to the seeded dataset (used by tests). */
export function resetMock() {
  ids.next = 1;
  state = freshState();
}

function generationFor(st, target, extra = {}) {
  const node = target?.nodeId
    ? st.nodes.find((n) => n.id === target.nodeId)
    : candidates(st, target?.model)[0];
  return {
    nodeId: node?.id ?? null, nodeName: node?.name ?? null, model: target?.model ?? null,
    auto: !target?.nodeId, presetId: null, presetName: null,
    contextLength: MODEL_DETAILS[target?.model]?.contextLength ?? 8192,
    promptTokens: null, completionTokens: null, ttftMs: null, totalMs: null, loadMs: null,
    thinkingMs: null, tokensPerSecond: null, finishReason: 'stop',
    ...extra,
  };
}

function appendMessage(conv, fields) {
  const previous = conv.messages[conv.messages.length - 1];
  const message = {
    id: newId(), seq: conv.messages.length + 1, parentId: previous?.id ?? null,
    role: 'user', content: '', thinking: null, attachments: [], toolCalls: [],
    status: 'complete', error: null, generation: null, createdAt: nowIso(), editedAt: null,
    ...fields,
  };
  conv.messages.push(message);
  return message;
}

const summarize = (conv, matchSnippet) => ({
  id: conv.id, title: conv.title, titleSource: conv.titleSource, pinned: conv.pinned,
  target: clone(conv.target), settings: clone(conv.settings), messageCount: conv.messages.length,
  createdAt: conv.createdAt, updatedAt: conv.updatedAt,
  ...(matchSnippet ? { matchSnippet } : {}),
});

const estimateTokens = (text) => Math.ceil([...(text || '')].length / 3) + 4;

function contextUsage(conv, target) {
  const resolved = target?.model ? target : conv.target;
  if (!resolved?.model) return null;
  const node = resolved.nodeId
    ? state.nodes.find((n) => n.id === resolved.nodeId)
    : candidates(state, resolved.model)[0];
  const contextLength = MODEL_DETAILS[resolved.model]?.contextLength ?? 8192;
  const budget = contextLength - Math.min(Math.max(contextLength / 4, 256), 2048);
  const base = { model: resolved.model, nodeId: node?.id ?? null, contextLength };

  const sent = conv.messages.filter((m) => m.role === 'user' || m.content);
  const totalTokens = sent.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  if (totalTokens <= budget) {
    return { ...base, usedTokens: totalTokens, totalTokens, fits: true, trimmedCount: 0, summaryActive: false };
  }

  // Newest first, as many as fit; a stored summary stands in for what it covers.
  const summary = conv.summary;
  const pool = summary ? sent.filter((m) => m.seq > summary.coversThroughSeq) : sent;
  let used = summary ? estimateTokens(summary.text) : 0;
  let included = 0;
  for (let i = pool.length - 1; i >= 0; i -= 1) {
    const tokens = estimateTokens(pool[i].content);
    if (used + tokens > budget) break;
    used += tokens;
    included += 1;
  }
  const trimmedCount = pool.length - included;
  return {
    ...base, usedTokens: used, totalTokens, fits: trimmedCount === 0, trimmedCount,
    summaryActive: Boolean(summary),
  };
}

function detail(conv) {
  return {
    ...summarize(conv),
    summary: clone(conv.summary),
    context: contextUsage(conv),
    messages: clone(conv.messages),
  };
}

function getConv(conversationId) {
  const conv = state.conversations.get(conversationId);
  if (!conv) throw new ApiError('Conversation not found', { status: 404 });
  return conv;
}

// --- Streaming turns ---------------------------------------------------------------------------

const REPLY_INTRO = [
  'Here is a quick answer, streamed by the mock so you can see the whole flow.',
  'Sure. This reply is generated locally by the dev mock, no backend involved.',
];

function replyFor(userText) {
  const intro = REPLY_INTRO[ids.next % REPLY_INTRO.length];
  const quoted = (userText || '').trim().split('\n')[0].slice(0, 80);
  return (
    `${intro}\n\nYou said: *${quoted || 'something with an attachment'}*\n\n` +
    '- Markdown lists render\n- So do `inline code` and [links](https://example.com)\n\n' +
    '```js\nconsole.log("hello from the mock");\n```\n\nAnything else?'
  );
}

const chunkText = (text) => text.match(/\S+\s*|\s+/g) ?? [];

/**
 * Runs one scripted turn: meta, loading_model (if cold), generating, thinking deltas (for models
 * that think), tokens, then done; or an error. Persists the assistant message either way.
 */
async function runTurn(conv, { userMessage, target, signal, onEvent, userText }) {
  const assistant = appendMessage(conv, { role: 'assistant', status: 'streaming' });
  const startedAt = Date.now();
  let first = true;
  const events = (name, data) => onEvent?.(name, data);
  const fail = (code, message, { alternatives } = {}) => {
    assistant.status = 'error';
    assistant.error = { code, message };
    assistant.generation = { ...generationFor(state, target), finishReason: 'error' };
    conv.updatedAt = nowIso();
    const data = {
      messageId: assistant.id, userMessageId: userMessage?.id ?? null, code, message,
      retryable: true, ...(alternatives ? { alternatives } : {}),
    };
    events('error', data);
    return { event: 'error', data };
  };

  // Resolve the target (contract section 4).
  const model = target.model;
  let node;
  if (target.nodeId) {
    node = state.nodes.find((n) => n.id === target.nodeId);
    if (!node || isOffline(node)) {
      return fail('NODE_OFFLINE', `${node?.name ?? 'That node'} is offline.`, {
        alternatives: alternativesFor(state, model, target.nodeId),
      });
    }
    if (!node.installed.includes(model)) {
      return fail('MODEL_NOT_ON_NODE', `${node.name} does not have ${model}.`, {
        alternatives: alternativesFor(state, model, target.nodeId),
      });
    }
  } else {
    node = candidates(state, model)[0];
    if (!node) return fail('NO_NODE_AVAILABLE', `No node can serve ${model} right now.`, { alternatives: [] });
  }

  const details = MODEL_DETAILS[model];
  const generation = generationFor(state, { model, nodeId: target.nodeId }, {
    nodeId: node.id, nodeName: node.name,
  });
  assistant.generation = generation;
  state.inFlight.add(assistant.id);
  node.activeGenerations += 1;

  const preflight = contextUsage(conv, target);

  try {
    events('meta', {
      conversationId: conv.id, userMessageId: userMessage?.id ?? null, assistantMessageId: assistant.id,
      nodeId: node.id, nodeName: node.name, model, auto: !target.nodeId, presetId: null,
      contextLength: details.contextLength,
      context: {
        promptTokensEstimate: preflight?.usedTokens ?? 0,
        trimmedCount: preflight?.trimmedCount ?? 0,
        summaryActive: preflight?.summaryActive ?? false,
        imagesOmitted: 0,
      },
    });

    let loadMs = 0;
    if (!node.loaded.includes(model)) {
      events('status', {
        phase: 'loading_model', nodeId: node.id, model, message: `Loading ${model} on ${node.name}…`,
      });
      await sleep(mockConfig.loadDelayMs, signal);
      node.loaded.push(model);
      loadMs = mockConfig.loadDelayMs;
    } else {
      await sleep(mockConfig.thinkDelayMs, signal);
    }
    events('status', { phase: 'generating' });

    if (userText?.startsWith('/fail')) {
      assistant.content = 'The connection to the node dro';
      events('token', { content: assistant.content });
      await sleep(mockConfig.tokenDelayMs, signal);
      assistant.generation = { ...generation, finishReason: 'error' };
      return fail('NODE_UNREACHABLE', `Lost the connection to ${node.name} mid-reply.`, {
        alternatives: alternativesFor(state, model, node.id),
      });
    }

    let thinkingMs = null;
    let ttftMs = null;
    if (details.capabilities.includes('thinking')) {
      const thinkingStartedAt = Date.now();
      assistant.thinking = '';
      for (const piece of [
        'The user is asking about ', `"${(userText || '').slice(0, 40)}". `,
        'I should answer briefly and use Markdown. ', 'A short list and a code block will do.',
      ]) {
        await sleep(mockConfig.thinkDelayMs, signal);
        assistant.thinking += piece;
        ttftMs ??= Date.now() - startedAt;
        events('thinking', { content: piece });
      }
      thinkingMs = Date.now() - thinkingStartedAt;
    }

    assistant.content = '';
    for (const piece of chunkText(replyFor(userText))) {
      await sleep(mockConfig.tokenDelayMs, signal);
      assistant.content += piece;
      if (first) {
        ttftMs ??= Date.now() - startedAt;
        first = false;
      }
      events('token', { content: piece });
    }

    // `/overflow` simulates a prompt that filled the model's whole window.
    const overflow = Boolean(userText?.startsWith('/overflow'));
    const promptTokens = overflow ? details.contextLength : (preflight?.usedTokens ?? 100);
    const completionTokens = estimateTokens(assistant.content);
    const totalMs = Date.now() - startedAt;
    const stats = {
      ttftMs: ttftMs ?? totalMs, totalMs, loadMs, thinkingMs,
      tokensPerSecond: totalMs > 0 ? Math.round((completionTokens / (totalMs / 1000)) * 10) / 10 : null,
    };
    assistant.status = 'complete';
    assistant.generation = {
      ...generation, promptTokens, completionTokens, contextLength: details.contextLength,
      ...stats, finishReason: 'stop',
    };
    conv.updatedAt = nowIso();
    const data = {
      messageId: assistant.id, userMessageId: userMessage?.id ?? null, promptTokens, completionTokens,
      contextLength: details.contextLength, finishReason: 'stop', contextOverflow: overflow, stats,
    };
    events('done', data);
    return { event: 'done', data };
  } catch (err) {
    if (err?.name === 'AbortError') {
      assistant.status = 'cancelled';
      assistant.generation = { ...generation, finishReason: 'cancelled' };
      conv.updatedAt = nowIso();
    }
    throw err;
  } finally {
    node.activeGenerations = Math.max(0, node.activeGenerations - 1);
    state.inFlight.delete(assistant.id);
  }
}

function startTurnPreconditions(conv) {
  const busy = conv.messages.some((m) => state.inFlight.has(m.id));
  if (busy) throw new ApiError('A reply is already being generated for this conversation.', { status: 409 });
}

function applyTarget(conv, target) {
  if (target?.model) {
    conv.target = { model: target.model, nodeId: target.nodeId ?? null };
    state.preferences = { ...state.preferences, lastTarget: clone(conv.target), updatedAt: nowIso() };
  }
  if (!conv.target?.model) {
    throw new ApiError('Pick a model first: the request and the conversation have no target.', { status: 400 });
  }
}

/** POST .../messages, .../messages/{id}/regenerate and .../messages/{id}/edit as an event stream. */
export async function handleStream(path, body = {}, { signal, onEvent } = {}) {
  await sleep(mockConfig.latencyMs, signal);
  const match = path.match(/^\/ai\/conversations\/([^/]+)\/messages(?:\/([^/]+)\/(regenerate|edit))?$/);
  if (!match) throw new ApiError(`No mock stream for ${path}`, { status: 404 });
  const [, conversationId, messageId, action] = match;
  const conv = getConv(decodeURIComponent(conversationId));
  startTurnPreconditions(conv);

  if (!action) {
    const content = (body.content || '').trim();
    if (!content && !(body.attachmentIds || []).length) {
      throw new ApiError('A message needs some text or an attachment.', { status: 400 });
    }
    if (content.length > 32000) throw new ApiError('The message is too long.', { status: 400 });
    applyTarget(conv, body.target);
    const attachments = (body.attachmentIds || []).map((attachmentId) => {
      const stored = state.attachments.get(attachmentId);
      if (!stored) throw new ApiError('Unknown attachment.', { status: 400 });
      return stored.meta;
    });
    const userMessage = appendMessage(conv, { role: 'user', content, attachments });
    if (conv.messages.filter((m) => m.role === 'user').length === 1) {
      conv.title = content.split('\n')[0].slice(0, 60) || 'New chat';
    }
    conv.updatedAt = nowIso();
    return runTurn(conv, { userMessage, target: conv.target, signal, onEvent, userText: content });
  }

  const index = conv.messages.findIndex((m) => m.id === decodeURIComponent(messageId));
  if (index === -1) throw new ApiError('Message not found', { status: 404 });
  const message = conv.messages[index];

  if (action === 'regenerate') {
    if (message.role !== 'assistant') throw new ApiError('Only an assistant message can be regenerated.', { status: 400 });
    applyTarget(conv, body.target);
    conv.messages.splice(index);
    const userMessage = conv.messages[conv.messages.length - 1];
    return runTurn(conv, { userMessage, target: conv.target, signal, onEvent, userText: userMessage?.content });
  }

  if (message.role !== 'user') throw new ApiError('Only a user message can be edited.', { status: 400 });
  const content = (body.content || '').trim();
  if (!content) throw new ApiError('A message needs some text.', { status: 400 });
  applyTarget(conv, body.target);
  conv.messages.splice(index + 1);
  message.content = content;
  message.editedAt = nowIso();
  if (body.attachmentIds) {
    message.attachments = body.attachmentIds.map((attachmentId) => state.attachments.get(attachmentId)?.meta).filter(Boolean);
  }
  conv.updatedAt = nowIso();
  return runTurn(conv, { userMessage: message, target: conv.target, signal, onEvent, userText: content });
}

// --- REST ---------------------------------------------------------------------------------------

function listConversationsHandler(query = {}) {
  const q = (query.q || '').trim().toLowerCase();
  const limit = Math.min(Number(query.limit) || 50, 200);
  const offset = Number(query.offset) || 0;
  const rows = [];

  [...state.conversations.values()].forEach((conv) => {
    if (!q) {
      rows.push(summarize(conv));
      return;
    }
    if (conv.title.toLowerCase().includes(q)) {
      rows.push(summarize(conv));
      return;
    }
    const hit = conv.messages.find((m) => (m.content || '').toLowerCase().includes(q));
    if (hit) {
      const at = hit.content.toLowerCase().indexOf(q);
      rows.push(summarize(conv, hit.content.slice(Math.max(0, at - 40), at + q.length + 100)));
    }
  });

  rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  return { items: rows.slice(offset, offset + limit), hasMore: rows.length > offset + limit };
}

function presetView(preset) {
  return { ...clone(preset), ownerUsername: 'mock-user', editable: true };
}

function simpleTitle(conv) {
  const firstUser = conv.messages.find((m) => m.role === 'user');
  const words = (firstUser?.content || 'New chat').replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(' ') || 'New chat';
}

const ROUTES = [
  ['GET', /^\/ai\/models$/, async () => buildCatalogue(state)],
  [
    'POST', /^\/ai\/warmup$/,
    async ({ body }) => {
      const node = body.nodeId ? state.nodes.find((n) => n.id === body.nodeId) : candidates(state, body.model)[0];
      if (!node || isOffline(node) || !node.installed.includes(body.model)) {
        return {
          state: 'unavailable', nodeId: node?.id ?? null, nodeName: node?.name ?? null, model: body.model,
          message: node && isOffline(node) ? `${node.name} is offline.` : 'No node can serve that model right now.',
        };
      }
      if (node.loaded.includes(body.model)) {
        return { state: 'loaded', nodeId: node.id, nodeName: node.name, model: body.model, message: null };
      }
      setTimeout(() => {
        if (!node.loaded.includes(body.model)) node.loaded.push(body.model);
      }, mockConfig.loadDelayMs);
      return { state: 'loading', nodeId: node.id, nodeName: node.name, model: body.model, message: null };
    },
  ],
  ['GET', /^\/ai\/preferences$/, async () => clone(state.preferences)],
  [
    'PUT', /^\/ai\/preferences$/,
    async ({ body }) => {
      state.preferences = {
        ...state.preferences,
        ...(body.lastTarget !== undefined && { lastTarget: clone(body.lastTarget) }),
        ...(body.lastPresetId !== undefined && { lastPresetId: body.lastPresetId }),
        updatedAt: nowIso(),
      };
      return clone(state.preferences);
    },
  ],
  ['GET', /^\/ai\/conversations$/, async ({ query }) => listConversationsHandler(query)],
  [
    'POST', /^\/ai\/conversations$/,
    async ({ body }) => {
      const createdAt = nowIso();
      const conv = {
        id: newId(), title: body.title || 'New chat', titleSource: body.title ? 'user' : 'default',
        pinned: false, target: body.target ? clone(body.target) : null,
        settings: { presetId: null, systemPrompt: null, ...clone(body.settings) },
        summary: null, messages: [], createdAt, updatedAt: createdAt,
      };
      state.conversations.set(conv.id, conv);
      if (conv.target) state.preferences = { ...state.preferences, lastTarget: clone(conv.target) };
      return summarize(conv);
    },
  ],
  ['GET', /^\/ai\/conversations\/([^/]+)$/, async ({ params }) => detail(getConv(params[0]))],
  [
    'PATCH', /^\/ai\/conversations\/([^/]+)$/,
    async ({ params, body }) => {
      const conv = getConv(params[0]);
      if (body.title !== undefined) {
        conv.title = String(body.title).slice(0, 120) || conv.title;
        conv.titleSource = 'user';
        conv.updatedAt = nowIso();
      }
      if (body.pinned !== undefined) conv.pinned = Boolean(body.pinned);
      if (body.target !== undefined) {
        conv.target = clone(body.target);
        conv.updatedAt = nowIso();
        if (body.target) state.preferences = { ...state.preferences, lastTarget: clone(body.target) };
      }
      if (body.settings !== undefined) {
        conv.settings = clone(body.settings);
        conv.updatedAt = nowIso();
      }
      return summarize(conv);
    },
  ],
  [
    'DELETE', /^\/ai\/conversations\/([^/]+)$/,
    async ({ params }) => {
      getConv(params[0]);
      state.conversations.delete(params[0]);
      return { deleted: true };
    },
  ],
  [
    'POST', /^\/ai\/conversations\/([^/]+)\/title$/,
    async ({ params }) => {
      const conv = getConv(params[0]);
      if (conv.titleSource !== 'user') {
        conv.title = simpleTitle(conv);
        conv.titleSource = 'auto';
      }
      return summarize(conv);
    },
  ],
  [
    'GET', /^\/ai\/conversations\/([^/]+)\/context$/,
    async ({ params, query }) => {
      const conv = getConv(params[0]);
      const target = query?.model ? { model: query.model, nodeId: query.nodeId || null } : null;
      const usage = contextUsage(conv, target);
      if (!usage) throw new ApiError('No model selected.', { status: 400 });
      return usage;
    },
  ],
  [
    'POST', /^\/ai\/conversations\/([^/]+)\/summarize$/,
    async ({ params }) => {
      const conv = getConv(params[0]);
      const usage = contextUsage(conv);
      if (!usage || usage.trimmedCount === 0) {
        throw new ApiError('Nothing to summarise: every message still fits.', { status: 409 });
      }
      // Fold the oldest trimmed messages (and any earlier summary) into one stored summary.
      const sent = conv.messages.filter((m) => m.role === 'user' || m.content);
      const pool = conv.summary ? sent.filter((m) => m.seq > conv.summary.coversThroughSeq) : sent;
      const lastCovered = pool[usage.trimmedCount - 1];
      conv.summary = {
        text: `Earlier in this chat (mock summary): ${pool.slice(0, usage.trimmedCount).filter((m) => m.role === 'user').map((m) => m.content.slice(0, 40)).join('; ')}.`,
        coversThroughSeq: lastCovered.seq, model: usage.model, partial: false, createdAt: nowIso(),
      };
      return { conversation: summarize(conv), summary: clone(conv.summary), context: contextUsage(conv) };
    },
  ],
  ['GET', /^\/ai\/presets$/, async () => ({ items: [...state.presets.values()].map(presetView) })],
  [
    'POST', /^\/ai\/presets$/,
    async ({ body }) => {
      if (!body.name?.trim()) throw new ApiError('A preset needs a name.', { status: 400 });
      const preset = {
        description: null, model: null, nodeId: null, systemPrompt: null, temperature: null, numCtx: null,
        visibility: 'private', requiredPermission: null, ...clone(body),
        id: newId(), createdAt: nowIso(), updatedAt: nowIso(),
      };
      state.presets.set(preset.id, preset);
      return presetView(preset);
    },
  ],
  [
    'PUT', /^\/ai\/presets\/([^/]+)$/,
    async ({ params, body }) => {
      const preset = state.presets.get(params[0]);
      if (!preset) throw new ApiError('Preset not found', { status: 404 });
      Object.assign(preset, clone(body), { id: preset.id, updatedAt: nowIso() });
      return presetView(preset);
    },
  ],
  [
    'DELETE', /^\/ai\/presets\/([^/]+)$/,
    async ({ params }) => {
      if (!state.presets.delete(params[0])) throw new ApiError('Preset not found', { status: 404 });
      return { deleted: true };
    },
  ],
  [
    'POST', /^\/ai\/attachments$/,
    async ({ body }) => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(body.mimeType)) {
        throw new ApiError('Only PNG, JPEG and WebP images can be attached.', { status: 400 });
      }
      const meta = {
        id: newId(), kind: 'image', mimeType: body.mimeType,
        sizeBytes: Math.floor((body.dataBase64?.length || 0) * 0.75), name: body.name,
      };
      state.attachments.set(meta.id, { meta, dataBase64: body.dataBase64 });
      return clone(meta);
    },
  ],
];

/** Answers one REST call like the API would: resolves with the JSON body or throws an ApiError. */
export async function handleRequest(method, path, { body, query, signal } = {}) {
  await sleep(mockConfig.latencyMs, signal);
  for (const [routeMethod, pattern, handler] of ROUTES) {
    const match = routeMethod === method ? path.match(pattern) : null;
    if (match) {
      const params = match.slice(1).map(decodeURIComponent);
      return handler({ params, body: body ?? {}, query: query ?? {} });
    }
  }
  throw new ApiError(`No mock for ${method} ${path}`, { status: 404 });
}

/** GET /ai/attachments/{id} -> Blob */
export async function getAttachmentBlob(attachmentId) {
  const stored = state.attachments.get(attachmentId);
  if (!stored) throw new ApiError('Attachment not found', { status: 404 });
  const bytes = Uint8Array.from(atob(stored.dataBase64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: stored.meta.mimeType });
}
