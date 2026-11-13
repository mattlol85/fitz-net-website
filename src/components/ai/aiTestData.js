/** Shared fixtures for the Matt-GPT component tests (shapes follow docs/ai-chat-contract.md). */

export const NODE_PC = 'node-pc';
export const NODE_RIG = 'node-rig';
export const NODE_GARAGE = 'node-garage';

const model = (name, extra = {}) => ({
  name,
  family: 'llama',
  parameterSize: '8.0B',
  quantization: 'Q4_K_M',
  sizeBytes: 4920753328,
  contextLength: 8192,
  maxContextLength: 131072,
  capabilities: ['completion'],
  loaded: false,
  loadedUntil: null,
  vramMb: null,
  ...extra,
});

/** Matt-PC (online, llama loaded, plus vision + thinking models), Rig-2 (cold) and Garage-Laptop (offline). */
export function makeCatalogue() {
  return {
    generatedAt: '2026-11-12T18:04:11Z',
    nodes: [
      {
        id: NODE_GARAGE, name: 'Garage-Laptop', status: 'OFFLINE', os: 'Ubuntu', activeGenerations: 0,
        catalogStale: true, vram: { totalMb: 8192, usedMb: null, source: null },
        models: [model('phi3:mini', { parameterSize: '3.8B', quantization: 'Q4_0', contextLength: 4096 })],
      },
      {
        id: NODE_PC, name: 'Matt-PC', status: 'ONLINE', os: 'Windows 11', activeGenerations: 0,
        catalogStale: false, vram: { totalMb: 16384, usedMb: 9216, source: 'heartbeat' },
        models: [
          model('llama3.1:8b', { loaded: true, vramMb: 5300 }),
          model('llama3.2-vision:11b', { parameterSize: '10.7B', capabilities: ['completion', 'vision'] }),
          model('qwen3:14b', { parameterSize: '14.8B', contextLength: 16384, capabilities: ['completion', 'thinking'] }),
        ],
      },
      {
        id: NODE_RIG, name: 'Rig-2', status: 'BUSY', os: 'Ubuntu', activeGenerations: 1,
        catalogStale: false, vram: { totalMb: 24576, usedMb: null, source: null },
        models: [model('llama3.1:8b')],
      },
    ],
    models: [
      {
        name: 'llama3.1:8b', nodeIds: [NODE_PC, NODE_RIG], loadedOn: [NODE_PC], autoNodeId: NODE_PC,
        parameterSize: '8.0B', quantization: 'Q4_K_M', contextLength: 8192, capabilities: ['completion'],
      },
      {
        name: 'llama3.2-vision:11b', nodeIds: [NODE_PC], loadedOn: [], autoNodeId: NODE_PC,
        parameterSize: '10.7B', quantization: 'Q4_K_M', contextLength: 8192, capabilities: ['completion', 'vision'],
      },
      {
        name: 'qwen3:14b', nodeIds: [NODE_PC], loadedOn: [], autoNodeId: NODE_PC,
        parameterSize: '14.8B', quantization: 'Q4_K_M', contextLength: 16384, capabilities: ['completion', 'thinking'],
      },
    ],
  };
}

export const makeConversation = (overrides = {}) => ({
  id: 'c1',
  title: 'Tuning the bell debounce',
  titleSource: 'auto',
  pinned: false,
  target: { model: 'llama3.1:8b', nodeId: null },
  settings: { presetId: null, systemPrompt: null },
  messageCount: 2,
  createdAt: '2026-11-12T10:00:00Z',
  updatedAt: '2026-11-12T10:05:00Z',
  ...overrides,
});

export const makeMessage = (overrides = {}) => ({
  id: 'm1',
  seq: 1,
  parentId: null,
  role: 'user',
  content: 'Hello',
  thinking: null,
  attachments: [],
  toolCalls: [],
  status: 'complete',
  error: null,
  generation: null,
  createdAt: '2026-11-12T10:00:00Z',
  editedAt: null,
  ...overrides,
});
