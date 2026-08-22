/**
 * AI worker node registry service — powers the Status tab's node graph.
 * Polls GET /node/list on fitz-net-api. In mock mode (VITE_USE_MOCK_API=true)
 * returns a small fake node list so the graph renders before any real node
 * has ever registered.
 */
import { API_URLS } from '../constants';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

const MOCK_NODES = [
  {
    id: 'mock-local-5070ti',
    name: 'local-5070ti',
    status: 'ONLINE',
    os: 'Windows',
    models: ['qwen3:14b', 'qwen3-coder:30b'],
    vramGb: 16,
    lastHeartbeatAt: new Date().toISOString(),
  },
  {
    id: 'mock-brother-pc',
    name: 'brother-pc',
    status: 'OFFLINE',
    os: 'Windows',
    models: ['qwen3-coder:30b'],
    vramGb: 24,
    lastHeartbeatAt: new Date(Date.now() - 15 * 60_000).toISOString(),
  },
];

export async function fetchNodes() {
  if (USE_MOCK) {
    return MOCK_NODES;
  }

  const response = await fetch(`${API_URLS.FITZ_NET_API}/node/list`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch node list: ${response.status}`);
  }

  return response.json();
}
