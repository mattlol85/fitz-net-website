/**
 * Fitz-Net platform architecture — the data behind the 3D graph on the Status
 * page.
 *
 * Layout is tiered rather than scattered: every node sits on one of four
 * horizontal tiers (edge → app → data → infrastructure) so the picture reads
 * top-to-bottom as "who talks to the outside world", "what runs the platform",
 * "what stores the data", and "what it all runs on".
 *
 * Links are drawn from the real cross-repo contracts:
 *   - fitz-net-website → fitz-net-api over REST, and → GamerBell over WebSocket
 *     directly (WebSocketButton.jsx), NOT via the API.
 *   - GamerBell is stateless and has no link to fitz-net-api at all.
 *   - GamerBell pulls firmware.bin from GitHub Releases and serves it OTA.
 *   - Fitz-Bot is its own island: JDA to Discord, REST to Radarr/Sonarr.
 */

export const NODE_TYPES = {
  FRONTEND: 'frontend',
  API_SERVER: 'api_server',
  BELL_RELAY: 'bell_relay',
  FIRMWARE: 'firmware',
  BOT: 'bot',
  DATABASE: 'database',
  AI_NODES: 'ai_nodes',
  EXTERNAL: 'external',
  PROXMOX_HOST: 'proxmox_host',
  RASPBERRY_PI: 'raspberry_pi',
  VM: 'vm',
  CONTAINER: 'container',
};

/** Physical machines — these share the bottom storey and lift together. */
export const HOST_TIER_TYPES = [NODE_TYPES.PROXMOX_HOST, NODE_TYPES.RASPBERRY_PI];

export const NODE_STATUS = {
  ONLINE: 'ONLINE',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN',
  INFERRED_ONLINE: 'INFERRED_ONLINE',
  INFERRED_UNKNOWN: 'INFERRED_UNKNOWN',
  UNMONITORED: 'UNMONITORED',
  EXTERNAL: 'EXTERNAL',
};

/** Single source of truth for status colors (hex ints for three.js materials). */
export const STATUS_COLOR = {
  [NODE_STATUS.ONLINE]: 0x10b981,
  [NODE_STATUS.DEGRADED]: 0xf59e0b,
  [NODE_STATUS.OFFLINE]: 0xef4444,
  [NODE_STATUS.UNKNOWN]: 0x6b7280,
  [NODE_STATUS.INFERRED_ONLINE]: 0x2dd4bf,
  [NODE_STATUS.INFERRED_UNKNOWN]: 0x6b7280,
  [NODE_STATUS.UNMONITORED]: 0x64748b,
  [NODE_STATUS.EXTERNAL]: 0x94a3b8,
};

export const STATUS_LABEL = {
  [NODE_STATUS.ONLINE]: 'Online',
  [NODE_STATUS.DEGRADED]: 'Degraded',
  [NODE_STATUS.OFFLINE]: 'Offline',
  [NODE_STATUS.UNKNOWN]: 'Unknown',
  [NODE_STATUS.INFERRED_ONLINE]: 'Reachable (inferred)',
  [NODE_STATUS.INFERRED_UNKNOWN]: 'Unreachable (inferred)',
  [NODE_STATUS.UNMONITORED]: 'Not monitored',
  [NODE_STATUS.EXTERNAL]: 'External service',
};

export function statusColor(status) {
  return STATUS_COLOR[status] ?? STATUS_COLOR[NODE_STATUS.UNKNOWN];
}

/**
 * Link types. The line colour encodes the *protocol*; the travelling pulse on
 * it encodes *liveness*, so the two pieces of information never fight.
 */
export const LINK_KINDS = {
  http: { label: 'REST / HTTP', color: 0x38bdf8 },
  ws: { label: 'WebSocket', color: 0xa78bfa },
  ota: { label: 'OTA firmware', color: 0xfbbf24 },
  db: { label: 'Database', color: 0x34d399 },
  external: { label: 'External API', color: 0xf472b6 },
  hosts: { label: 'Hypervisor hosts VM', color: 0xe57000, dashed: true },
  deployedOn: { label: 'Runs on host', color: 0xc51a4a, dashed: true },
  runsOn: { label: 'Container in VM', color: 0x2496ed, dashed: true },
  mirror: { label: 'Container ↔ service', color: 0x64748b, dashed: true },
};

/** Tier heights — the vertical storey each node lives on. */
export const TIER_Y = {
  EDGE: 4.0,
  APP: 1.0,
  DATA: -1.7,
  CONTAINER: -4.3, // sits on the VM deck (VM + 0.5)
  VM: -4.8,
  HOST: -6.6,
};

/**
 * With the infra layer collapsed there is no VM tier to make room for, so the
 * host rides up to here and drops to TIER_Y.HOST when you expand it.
 */
export const HOST_COLLAPSED_Y = -4.3;

/** Scene is authored around this centre, then re-centred on the orbit pivot. */
export const LAYOUT_CENTER = [1.2, -1.0, 0];

export const ARCHITECTURE_NODES = [
  // ---- Edge tier: devices we own + third-party systems we depend on --------
  {
    id: 'esp32-bell',
    label: 'ESP32 Bell',
    type: NODE_TYPES.FIRMWARE,
    position: [3.4, TIER_Y.EDGE, 0],
    statusSource: { kind: 'inferred', from: 'gamerbell', rule: 'ota-reachable' },
    detail: {
      repo: 'Esp32FitznetBell',
      role: 'ESP32 bell button — WS2812B ring, OLED, OTA self-flash',
      facts: [
        'Button GPIO 13, 12-LED ring GPIO 5, OLED on I²C 21/22',
        'Sends PRESSED / RELEASED over wss to GamerBell /ws',
        'Polls GET /count every 10s, checks OTA every 60s',
      ],
    },
  },
  {
    id: 'github-releases',
    label: 'GitHub Releases',
    type: NODE_TYPES.EXTERNAL,
    position: [-0.2, TIER_Y.EDGE, -0.4],
    accent: 0xa1a1aa,
    statusSource: { kind: 'external' },
    detail: {
      role: 'Source of firmware.bin for OTA updates',
      facts: ['mattlol85/Esp32FitznetBell releases', 'Cut a release → every bell self-updates'],
    },
  },
  {
    id: 'discord',
    label: 'Discord',
    type: NODE_TYPES.EXTERNAL,
    position: [6.8, TIER_Y.EDGE, -0.4],
    accent: 0x5865f2,
    statusSource: { kind: 'external' },
    detail: { role: 'Gateway Fitz-Bot connects to via JDA' },
  },
  {
    id: 'joenet-media',
    label: 'Radarr / Sonarr',
    type: NODE_TYPES.EXTERNAL,
    position: [9.6, TIER_Y.EDGE, -0.4],
    accent: 0xf59e0b,
    statusSource: { kind: 'external' },
    detail: {
      role: 'JoeNet media stack Fitz-Bot drives',
      facts: ['Radarr :7878 (movies)', 'Sonarr :8989 (TV)'],
    },
  },

  // ---- App tier -----------------------------------------------------------
  {
    id: 'fitz-net-website',
    label: 'fitz-net-website',
    type: NODE_TYPES.FRONTEND,
    position: [-7.0, TIER_Y.APP, 0],
    statusSource: { kind: 'actuator', configName: 'fitz-net-website' },
    detail: {
      repo: 'fitz-net-website',
      role: 'React 19 + Vite SPA (this app)',
      facts: ['Calls fitz-net-api over REST', 'Opens its own WebSocket to GamerBell'],
    },
  },
  {
    id: 'fitz-net-api',
    label: 'fitz-net-api',
    type: NODE_TYPES.API_SERVER,
    position: [-3.0, TIER_Y.APP, 0],
    statusSource: { kind: 'actuator', configName: 'fitz-net-api' },
    detail: {
      repo: 'fitz-net-api',
      role: 'Java 21 / Spring Boot 3.4 REST backend',
      facts: [
        '/user/create, /login, /readAll, /delete',
        '/node/register, /node/heartbeat, /node/list',
        'JWT auth, MongoDB persistence, Prometheus metrics',
      ],
    },
  },
  {
    id: 'gamerbell',
    label: 'GamerBell',
    type: NODE_TYPES.BELL_RELAY,
    position: [1.8, TIER_Y.APP, 0],
    statusSource: { kind: 'actuator', configName: 'gamerbell' },
    detail: {
      repo: 'GamerBell',
      role: 'Stateless WebSocket relay + OTA firmware server',
      facts: [
        '/ws — broadcasts button events to every session',
        'GET /count — active session count',
        'GET /api/firmware/latest — streams .bin, 304 when current',
        'POST /api/devices/log — device telemetry into Loki',
        'No database by design — sessions are in-memory',
      ],
    },
  },
  {
    id: 'fitz-bot',
    label: 'Fitz-Bot',
    type: NODE_TYPES.BOT,
    position: [7.6, TIER_Y.APP, 0],
    statusSource: { kind: 'unmonitored' },
    detail: {
      repo: 'Fitz-Bot',
      role: 'Discord bot (JDA 5) — voice milestones, media requests',
      facts: [
        'Radarr / Sonarr download commands',
        'Thymeleaf dashboard + actuator',
        'Runs on its own Raspberry Pi, not the Proxmox box',
      ],
    },
  },

  // ---- Data tier ----------------------------------------------------------
  {
    id: 'mongo',
    label: 'MongoDB',
    type: NODE_TYPES.DATABASE,
    position: [-5.2, TIER_Y.DATA, 0],
    statusSource: {
      kind: 'nested-health',
      configName: 'fitz-net-api',
      path: ['components', 'mongo'],
      fallbackPath: ['components', 'mongoHealth'],
    },
    detail: {
      role: "fitz-net-api's datastore — users and AI node registry",
      facts: ['Health surfaced through the API actuator, not probed directly'],
    },
  },
  {
    id: 'ai-nodes',
    label: 'AI Worker Nodes',
    type: NODE_TYPES.AI_NODES,
    position: [-1.6, TIER_Y.DATA, 0],
    statusSource: { kind: 'unmonitored' },
    jumpToAiNodes: true,
    detail: {
      role: 'GPU workers that register with fitz-net-api and heartbeat',
      facts: ['Enrolled via /node/enrollment-token', 'Live roster in the graph below'],
    },
  },
];

export const ARCHITECTURE_EDGES = [
  { from: 'fitz-net-website', to: 'fitz-net-api', kind: 'http', note: '/user/*, /node/list' },
  { from: 'fitz-net-website', to: 'gamerbell', kind: 'ws', note: '/ws — button events' },
  { from: 'esp32-bell', to: 'gamerbell', kind: 'ws', note: 'PRESSED/RELEASED, /count, device logs' },
  { from: 'gamerbell', to: 'github-releases', kind: 'ota', note: 'pulls firmware.bin' },
  { from: 'gamerbell', to: 'esp32-bell', kind: 'ota', note: 'serves OTA update', curve: 0.9 },
  { from: 'fitz-net-api', to: 'mongo', kind: 'db', note: 'Spring Data MongoDB' },
  { from: 'fitz-net-api', to: 'ai-nodes', kind: 'http', note: 'register / heartbeat / list' },
  { from: 'fitz-bot', to: 'discord', kind: 'external', note: 'JDA gateway' },
  { from: 'fitz-bot', to: 'joenet-media', kind: 'external', note: 'Radarr :7878 / Sonarr :8989' },
];

// ---- Infrastructure layer (revealed by clicking, static topology) ----------

export const PROXMOX_NODE = {
  id: 'proxmox',
  label: 'Proxmox VE',
  type: NODE_TYPES.PROXMOX_HOST,
  position: [1.0, TIER_Y.HOST, 0],
  statusSource: { kind: 'unmonitored' },
  expandable: true,
  detail: {
    role: 'Hypervisor host — everything below runs on this box',
    facts: ['Click to show / hide its VMs'],
  },
};

/** Fitz-Bot lives on its own little box, off to the side of the hypervisor. */
export const RASPBERRY_PI_NODE = {
  id: 'raspberry-pi',
  label: 'Raspberry Pi',
  type: NODE_TYPES.RASPBERRY_PI,
  position: [8.4, TIER_Y.HOST, 0],
  statusSource: { kind: 'unmonitored' },
  detail: {
    role: 'Single-board host dedicated to Fitz-Bot',
    facts: [
      'Runs the Fitz-Bot Discord service',
      'Separate physical machine from the Proxmox host',
    ],
  },
};

export const VM_NODES = [
  {
    id: 'vm-docker',
    label: 'docker-vm',
    type: NODE_TYPES.VM,
    position: [-3.2, TIER_Y.VM, 0],
    statusSource: { kind: 'unmonitored' },
    expandable: true,
    dockerStack: ['fitz-net-website', 'fitz-net-api', 'gamerbell', 'mongo'],
    detail: { role: 'Runs the Fitz-Net Docker stack', facts: ['Click to show / hide containers'] },
  },
  {
    id: 'vm-gameserver',
    label: 'game-server-vm',
    type: NODE_TYPES.VM,
    position: [5.4, TIER_Y.VM, 0],
    statusSource: { kind: 'unmonitored' },
    expandable: true,
    dockerStack: [],
    detail: { role: 'Test VM — provisioned but currently running nothing' },
  },
];

export const INFRA_EDGES = [
  ...VM_NODES.map((vm) => ({ from: 'proxmox', to: vm.id, kind: 'hosts' })),
  { from: 'fitz-bot', to: 'raspberry-pi', kind: 'deployedOn', note: 'deployed on this Pi' },
];

/** Lay a VM's containers out in a neat row sitting on top of that VM's platform. */
function containerPosition(vmPosition, index, total) {
  const spacing = 1.35;
  const startX = vmPosition[0] - ((total - 1) * spacing) / 2;
  return [startX + index * spacing, TIER_Y.CONTAINER, vmPosition[2]];
}

export function buildContainerNodes(vmNode) {
  return vmNode.dockerStack.map((serviceId, index) => {
    const service = ARCHITECTURE_NODES.find((n) => n.id === serviceId);
    return {
      id: `container-${vmNode.id}-${serviceId}`,
      label: service?.label || serviceId,
      type: NODE_TYPES.CONTAINER,
      serviceId,
      vmId: vmNode.id,
      isContainer: true,
      position: containerPosition(vmNode.position, index, vmNode.dockerStack.length),
      statusSource: service?.statusSource || { kind: 'unmonitored' },
      detail: {
        role: `Docker container running ${service?.label || serviceId}`,
        hostVm: vmNode.label,
      },
    };
  });
}

const CONTAINER_NODES = VM_NODES.flatMap(buildContainerNodes);

const CONTAINER_EDGES = CONTAINER_NODES.flatMap((container) => [
  { from: container.vmId, to: container.id, kind: 'runsOn' },
  { from: container.id, to: container.serviceId, kind: 'mirror' },
]);

/** Every node the scene can render, including the collapsed infra layer. */
export const ALL_NODES = [
  ...ARCHITECTURE_NODES,
  PROXMOX_NODE,
  RASPBERRY_PI_NODE,
  ...VM_NODES,
  ...CONTAINER_NODES,
];

export const ALL_EDGES = [...ARCHITECTURE_EDGES, ...INFRA_EDGES, ...CONTAINER_EDGES];
