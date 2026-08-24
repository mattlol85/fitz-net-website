/**
 * Pure(ish) status-derivation logic for the architecture graph. Given the
 * `apiStatuses` array StatusDashboard already fetches (name/online/health/info
 * per configured API), work out a NODE_STATUS for every ARCHITECTURE_NODES
 * entry — including the three that have no dedicated health endpoint today.
 */
import { API_CONFIGS } from '../constants';
import { NODE_STATUS } from '../constants/architecture';

function findApiStatus(apiStatuses, configName) {
  return apiStatuses?.find((api) => api.name === configName) || null;
}

function actuatorStatus(apiStatuses, configName) {
  const api = findApiStatus(apiStatuses, configName);
  if (!api || !api.online) return NODE_STATUS.OFFLINE;
  const status = api.health?.status?.toUpperCase();
  if (status === 'UP') return NODE_STATUS.ONLINE;
  if (status === 'DOWN') return NODE_STATUS.OFFLINE;
  return NODE_STATUS.DEGRADED;
}

function readPath(obj, path) {
  return path.reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function nestedHealthStatus(apiStatuses, { configName, path, fallbackPath }) {
  const api = findApiStatus(apiStatuses, configName);
  if (!api || !api.online) return NODE_STATUS.UNKNOWN;
  const component = readPath(api.health, path) || readPath(api.health, fallbackPath);
  const status = component?.status?.toUpperCase();
  if (status === 'UP') return NODE_STATUS.ONLINE;
  if (status === 'DOWN') return NODE_STATUS.OFFLINE;
  return NODE_STATUS.UNKNOWN;
}

/**
 * Reachability probe for GamerBell's OTA endpoint. Used to infer the
 * Esp32FitznetBell pipeline is alive without a dedicated firmware health
 * endpoint. Resolves to a NODE_STATUS, never throws.
 */
export async function probeGamerBellOta(gamerBellUrl, { timeoutMs = 4000 } = {}) {
  const url = import.meta.env.PROD
    ? `${gamerBellUrl}/api/firmware/latest`
    : '/gamerbell-firmware/latest';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return response.ok ? NODE_STATUS.INFERRED_ONLINE : NODE_STATUS.INFERRED_UNKNOWN;
  } catch {
    return NODE_STATUS.INFERRED_UNKNOWN;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Derive a NODE_STATUS for one ARCHITECTURE_NODES entry.
 * `inferredStatuses` maps node id -> NODE_STATUS for async-derived ('inferred')
 * nodes, since those require a network probe the caller resolves separately.
 */
export function deriveNodeStatus(node, apiStatuses, inferredStatuses = {}) {
  const { statusSource } = node;
  switch (statusSource.kind) {
    case 'actuator':
      return actuatorStatus(apiStatuses, statusSource.configName);
    case 'nested-health':
      return nestedHealthStatus(apiStatuses, statusSource);
    case 'inferred':
      return inferredStatuses[node.id] ?? NODE_STATUS.INFERRED_UNKNOWN;
    case 'external':
      return NODE_STATUS.EXTERNAL;
    case 'unmonitored':
    default:
      return NODE_STATUS.UNMONITORED;
  }
}

/**
 * Resolve every 'inferred' node's status by running its probe. Returns a map
 * of node id -> NODE_STATUS.
 */
export async function resolveInferredStatuses(nodes, apiStatuses) {
  const inferredNodes = nodes.filter((n) => n.statusSource.kind === 'inferred');
  const entries = await Promise.all(
    inferredNodes.map(async (node) => {
      if (node.statusSource.rule === 'ota-reachable') {
        const fromApi = findApiStatus(apiStatuses, node.statusSource.from);
        const gamerBellConfig = API_CONFIGS.find((c) => c.name === node.statusSource.from);
        if (!fromApi?.online || !gamerBellConfig) {
          return [node.id, NODE_STATUS.INFERRED_UNKNOWN];
        }
        return [node.id, await probeGamerBellOta(gamerBellConfig.url)];
      }
      return [node.id, NODE_STATUS.INFERRED_UNKNOWN];
    })
  );
  return Object.fromEntries(entries);
}
