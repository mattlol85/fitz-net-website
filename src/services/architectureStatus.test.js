import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deriveNodeStatus, probeGamerBellOta, resolveInferredStatuses } from './architectureStatus';
import {
  NODE_STATUS,
  ARCHITECTURE_NODES,
  ARCHITECTURE_EDGES,
  ALL_NODES,
  ALL_EDGES,
  VM_NODES,
} from '../constants/architecture';

describe('deriveNodeStatus', () => {
  it('maps an online actuator with UP health to ONLINE', () => {
    const node = { statusSource: { kind: 'actuator', configName: 'fitz-net-api' } };
    const apiStatuses = [{ name: 'fitz-net-api', online: true, health: { status: 'UP' } }];
    expect(deriveNodeStatus(node, apiStatuses)).toBe(NODE_STATUS.ONLINE);
  });

  it('maps an offline actuator entry to OFFLINE', () => {
    const node = { statusSource: { kind: 'actuator', configName: 'fitz-net-api' } };
    const apiStatuses = [{ name: 'fitz-net-api', online: false }];
    expect(deriveNodeStatus(node, apiStatuses)).toBe(NODE_STATUS.OFFLINE);
  });

  it('maps an online actuator with an unrecognized health status to DEGRADED', () => {
    const node = { statusSource: { kind: 'actuator', configName: 'fitz-net-api' } };
    const apiStatuses = [{ name: 'fitz-net-api', online: true, health: { status: 'UNKNOWN' } }];
    expect(deriveNodeStatus(node, apiStatuses)).toBe(NODE_STATUS.DEGRADED);
  });

  it('reads nested mongo health from fitz-net-api', () => {
    const node = {
      statusSource: {
        kind: 'nested-health',
        configName: 'fitz-net-api',
        path: ['components', 'mongo'],
        fallbackPath: ['components', 'mongoHealth'],
      },
    };
    const apiStatuses = [
      { name: 'fitz-net-api', online: true, health: { components: { mongo: { status: 'UP' } } } },
    ];
    expect(deriveNodeStatus(node, apiStatuses)).toBe(NODE_STATUS.ONLINE);
  });

  it('falls back to the fallbackPath for nested health when the primary path is absent', () => {
    const node = {
      statusSource: {
        kind: 'nested-health',
        configName: 'fitz-net-api',
        path: ['components', 'mongo'],
        fallbackPath: ['components', 'mongoHealth'],
      },
    };
    const apiStatuses = [
      { name: 'fitz-net-api', online: true, health: { components: { mongoHealth: { status: 'DOWN' } } } },
    ];
    expect(deriveNodeStatus(node, apiStatuses)).toBe(NODE_STATUS.OFFLINE);
  });

  it('reports UNKNOWN for nested health when the parent api is offline', () => {
    const node = {
      statusSource: {
        kind: 'nested-health',
        configName: 'fitz-net-api',
        path: ['components', 'mongo'],
        fallbackPath: ['components', 'mongoHealth'],
      },
    };
    const apiStatuses = [{ name: 'fitz-net-api', online: false }];
    expect(deriveNodeStatus(node, apiStatuses)).toBe(NODE_STATUS.UNKNOWN);
  });

  it('reads a resolved inferred status from the provided map', () => {
    const node = { id: 'esp32-bell', statusSource: { kind: 'inferred', from: 'gamerbell', rule: 'ota-reachable' } };
    expect(deriveNodeStatus(node, [], { 'esp32-bell': NODE_STATUS.INFERRED_ONLINE })).toBe(
      NODE_STATUS.INFERRED_ONLINE
    );
  });

  it('defaults an unresolved inferred node to INFERRED_UNKNOWN', () => {
    const node = { id: 'esp32-bell', statusSource: { kind: 'inferred', from: 'gamerbell', rule: 'ota-reachable' } };
    expect(deriveNodeStatus(node, [])).toBe(NODE_STATUS.INFERRED_UNKNOWN);
  });

  it('always reports UNMONITORED for unmonitored nodes', () => {
    const node = { statusSource: { kind: 'unmonitored' } };
    expect(deriveNodeStatus(node, [])).toBe(NODE_STATUS.UNMONITORED);
  });

  it('reports EXTERNAL for third-party systems', () => {
    const node = { statusSource: { kind: 'external' } };
    expect(deriveNodeStatus(node, [])).toBe(NODE_STATUS.EXTERNAL);
  });
});

describe('architecture topology', () => {
  const edgeExists = (from, to) =>
    ARCHITECTURE_EDGES.some((e) => e.from === from && e.to === to);

  it('links the website straight to GamerBell over WebSocket, not via the API', () => {
    expect(edgeExists('fitz-net-website', 'gamerbell')).toBe(true);
    const wsEdge = ARCHITECTURE_EDGES.find(
      (e) => e.from === 'fitz-net-website' && e.to === 'gamerbell'
    );
    expect(wsEdge.kind).toBe('ws');
  });

  it('has no link between fitz-net-api and GamerBell — they are independent', () => {
    expect(edgeExists('fitz-net-api', 'gamerbell')).toBe(false);
    expect(edgeExists('gamerbell', 'fitz-net-api')).toBe(false);
  });

  it('routes firmware from GitHub Releases through GamerBell to the ESP32', () => {
    expect(edgeExists('gamerbell', 'github-releases')).toBe(true);
    expect(edgeExists('gamerbell', 'esp32-bell')).toBe(true);
  });

  it('runs Fitz-Bot on the Raspberry Pi, not in the docker-vm stack', () => {
    const dockerVm = VM_NODES.find((vm) => vm.id === 'vm-docker');
    expect(dockerVm.dockerStack).not.toContain('fitz-bot');

    const piLink = ALL_EDGES.find((e) => e.from === 'fitz-bot' && e.to === 'raspberry-pi');
    expect(piLink).toBeDefined();
    expect(piLink.kind).toBe('deployedOn');
  });

  it('every edge points at a node that actually exists', () => {
    const ids = new Set(ALL_NODES.map((n) => n.id));
    ALL_EDGES.forEach((edge) => {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    });
  });
});

describe('probeGamerBellOta', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('resolves INFERRED_ONLINE on a successful response', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    const status = await probeGamerBellOta('https://gamerbell.example.com');
    expect(status).toBe(NODE_STATUS.INFERRED_ONLINE);
  });

  it('resolves INFERRED_UNKNOWN on a failed response', async () => {
    fetch.mockResolvedValueOnce({ ok: false });
    const status = await probeGamerBellOta('https://gamerbell.example.com');
    expect(status).toBe(NODE_STATUS.INFERRED_UNKNOWN);
  });

  it('resolves INFERRED_UNKNOWN instead of throwing on a network error', async () => {
    fetch.mockRejectedValueOnce(new Error('network down'));
    const status = await probeGamerBellOta('https://gamerbell.example.com');
    expect(status).toBe(NODE_STATUS.INFERRED_UNKNOWN);
  });
});

describe('resolveInferredStatuses', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('probes gamerbell for the esp32-bell node when gamerbell is online', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    const apiStatuses = [{ name: 'gamerbell', online: true, health: { status: 'UP' } }];
    const result = await resolveInferredStatuses(ARCHITECTURE_NODES, apiStatuses);
    expect(result['esp32-bell']).toBe(NODE_STATUS.INFERRED_ONLINE);
  });

  it('skips the probe and reports INFERRED_UNKNOWN when gamerbell is offline', async () => {
    const apiStatuses = [{ name: 'gamerbell', online: false }];
    const result = await resolveInferredStatuses(ARCHITECTURE_NODES, apiStatuses);
    expect(result['esp32-bell']).toBe(NODE_STATUS.INFERRED_UNKNOWN);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should report INFERRED_UNKNOWN for inferred nodes with an unknown rule', async () => {
    const node = { id: 'custom', statusSource: { kind: 'inferred', rule: 'other', from: 'gamerbell' } };
    const result = await resolveInferredStatuses([node], [{ name: 'gamerbell', online: true }]);
    expect(result.custom).toBe(NODE_STATUS.INFERRED_UNKNOWN);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should report INFERRED_UNKNOWN when the source API has no configured URL', async () => {
    const node = { id: 'custom', statusSource: { kind: 'inferred', rule: 'ota-reachable', from: 'not-configured' } };
    const result = await resolveInferredStatuses([node], [{ name: 'not-configured', online: true }]);
    expect(result.custom).toBe(NODE_STATUS.INFERRED_UNKNOWN);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('architecture status edge cases', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should report DEGRADED for an online actuator that sends no health status', () => {
    const node = { statusSource: { kind: 'actuator', configName: 'fitz-net-api' } };
    expect(deriveNodeStatus(node, [{ name: 'fitz-net-api', online: true }])).toBe(NODE_STATUS.DEGRADED);
  });

  it('should report UNKNOWN for nested health with an unrecognised status', () => {
    const node = {
      statusSource: { kind: 'nested-health', configName: 'fitz-net-api', path: ['components', 'mongo'], fallbackPath: ['components', 'mongoHealth'] },
    };
    const apiStatuses = [{ name: 'fitz-net-api', online: true, health: { components: { mongo: { status: 'WEIRD' } } } }];
    expect(deriveNodeStatus(node, apiStatuses)).toBe(NODE_STATUS.UNKNOWN);
  });

  it('should report UNKNOWN for nested health when neither component path is present', () => {
    const node = {
      statusSource: { kind: 'nested-health', configName: 'fitz-net-api', path: ['components', 'mongo'], fallbackPath: ['components', 'mongoHealth'] },
    };
    expect(deriveNodeStatus(node, [{ name: 'fitz-net-api', online: true, health: {} }])).toBe(NODE_STATUS.UNKNOWN);
  });

  it('should probe the production GamerBell firmware endpoint in production builds', async () => {
    vi.stubEnv('PROD', true);
    fetch.mockResolvedValueOnce({ ok: true });

    const status = await probeGamerBellOta('https://gamerbell.example.com');

    expect(status).toBe(NODE_STATUS.INFERRED_ONLINE);
    expect(fetch.mock.calls[0][0]).toBe('https://gamerbell.example.com/api/firmware/latest');
  });
});
