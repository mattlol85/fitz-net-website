import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ALL_NODES,
  ALL_EDGES,
  LINK_KINDS,
  LAYOUT_CENTER,
  HOST_COLLAPSED_Y,
  HOST_TIER_TYPES,
  NODE_TYPES,
  NODE_STATUS,
  STATUS_LABEL,
  TIER_Y,
  statusColor,
} from '../constants/architecture';
import { deriveNodeStatus, resolveInferredStatuses } from '../services/architectureStatus';
import { createRendererOrNull } from '../utils/webgl';
import { useThreeHoverRaycast } from '../hooks/useThreeHoverRaycast';
import { watchThemeChange } from '../utils/themeColors';
import '../css/ArchitectureGraph.css';

/** Shared material palette — deliberately mid-tone so nothing vanishes on a dark page. */
const C = {
  slate: 0x64748b,
  darkSlate: 0x334155,
  panel: 0x1e293b,
  light: 0xe2e8f0,
  react: 0x38bdf8,
  spring: 0x6db33f,
  gold: 0xf5b301,
  mongo: 0x00ed64,
  docker: 0x2496ed,
  blurple: 0x5865f2,
  pcb: 0x15803d,
  proxmox: 0xe57000,
  cyan: 0x22d3ee,
  amber: 0xf59e0b,
};

const std = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.18, ...opts });
const glow = (color, intensity = 0.7, opts = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    ...opts,
  });

/** Where each icon's label and status dot sit relative to the node origin. */
const LABEL_OFFSET_Y = {
  [NODE_TYPES.FRONTEND]: -1.25,
  [NODE_TYPES.API_SERVER]: -1.0,
  [NODE_TYPES.BELL_RELAY]: -0.95,
  [NODE_TYPES.FIRMWARE]: -0.85,
  [NODE_TYPES.BOT]: -0.95,
  [NODE_TYPES.DATABASE]: -1.15,
  [NODE_TYPES.AI_NODES]: -0.85,
  [NODE_TYPES.EXTERNAL]: -0.85,
  [NODE_TYPES.PROXMOX_HOST]: -0.95,
  [NODE_TYPES.RASPBERRY_PI]: -0.85,
  [NODE_TYPES.VM]: -0.55,
  // containers sit on the VM deck, so their label goes above them instead
  [NODE_TYPES.CONTAINER]: 0.8,
};

const DOT_OFFSET_Y = {
  [NODE_TYPES.FRONTEND]: 0.95,
  [NODE_TYPES.API_SERVER]: 0.85,
  [NODE_TYPES.BELL_RELAY]: 0.95,
  [NODE_TYPES.FIRMWARE]: 0.85,
  [NODE_TYPES.BOT]: 0.95,
  [NODE_TYPES.DATABASE]: 0.9,
  [NODE_TYPES.AI_NODES]: 0.6,
  [NODE_TYPES.EXTERNAL]: 0.65,
  [NODE_TYPES.PROXMOX_HOST]: 0.7,
  [NODE_TYPES.RASPBERRY_PI]: 0.85,
  [NODE_TYPES.VM]: 0.35,
  [NODE_TYPES.CONTAINER]: 0.5,
};

const STRUCTURAL_TYPES = [
  NODE_TYPES.PROXMOX_HOST,
  NODE_TYPES.RASPBERRY_PI,
  NODE_TYPES.VM,
  NODE_TYPES.CONTAINER,
];
const EXPANDABLE_TYPES = [NODE_TYPES.PROXMOX_HOST, NODE_TYPES.VM];

function isOnlineish(status) {
  return status === NODE_STATUS.ONLINE || status === NODE_STATUS.INFERRED_ONLINE;
}

/** A node is visible once every ancestor in its expand chain is expanded. */
function isNodeVisible(node, expandedIds) {
  if (!node) return false;
  if (node.type === NODE_TYPES.VM) return expandedIds.has('proxmox');
  if (node.isContainer) return expandedIds.has('proxmox') && expandedIds.has(node.vmId);
  return true;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

/** fitz-net-website — a monitor showing a browser window. */
function buildFrontend() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.3, 0.14), std(C.darkSlate)));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.06), glow(C.react, 0.45));
  screen.position.z = 0.08;
  g.add(screen);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.18, 0.02), std(C.panel));
  bar.position.set(0, 0.44, 0.1);
  g.add(bar);
  [-0.78, -0.66, -0.54].forEach((x, i) => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      glow([0xef4444, 0xf59e0b, 0x22c55e][i], 0.8)
    );
    dot.position.set(x, 0.44, 0.12);
    g.add(dot);
  });
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.14), std(C.darkSlate));
  neck.position.y = -0.8;
  g.add(neck);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.34), std(C.slate));
  foot.position.y = -0.98;
  g.add(foot);
  return g;
}

/** fitz-net-api — a rack-mount server. */
function buildApiServer() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.1, 1.15), std(C.slate)));
  const face = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.1, 0.05), std(C.darkSlate));
  face.position.z = 0.58;
  g.add(face);
  for (let i = 0; i < 3; i += 1) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.04), std(C.panel));
    slot.position.set(-0.16, 0.3 - i * 0.31, 0.61);
    g.add(slot);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), glow(C.spring, 1));
    led.position.set(0.72, 0.3 - i * 0.31, 0.62);
    g.add(led);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.06, 0.03), glow(C.spring, 0.6));
  stripe.position.set(0, 0.52, 0.6);
  g.add(stripe);
  return g;
}

/** GamerBell — an actual bell, with broadcast arcs for the relay role. */
function buildBellRelay() {
  const g = new THREE.Group();
  const profile = [
    [0.05, 0.98],
    [0.2, 0.94],
    [0.26, 0.84],
    [0.36, 0.62],
    [0.48, 0.36],
    [0.6, 0.13],
    [0.7, 0.03],
    [0.72, 0.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bell = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 32),
    std(C.gold, { metalness: 0.65, roughness: 0.28, side: THREE.DoubleSide })
  );
  bell.position.y = -0.42;
  g.add(bell);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 10, 20), std(C.gold, { metalness: 0.7 }));
  loop.position.y = 0.62;
  g.add(loop);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), std(0x92400e, { metalness: 0.6 }));
  clapper.position.y = -0.52;
  g.add(clapper);
  // broadcast arcs either side — the "relay" half of its job
  [-1, 1].forEach((side) => {
    [0.95, 1.2].forEach((radius, i) => {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.022, 8, 20, Math.PI * 0.42),
        glow(C.amber, 0.6, { transparent: true, opacity: 0.55 - i * 0.15 })
      );
      arc.rotation.z = side > 0 ? -Math.PI * 0.21 : Math.PI * 0.79;
      arc.position.y = -0.1;
      g.add(arc);
    });
  });
  return g;
}

/** Esp32FitznetBell — the real dev board: module, OLED, 12-LED ring, button. */
function buildFirmware() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.2), std(C.pcb, { roughness: 0.7 })));
  const module = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.74), std(0xcbd5e1, { metalness: 0.6 }));
  module.position.set(-0.56, 0.12, 0);
  g.add(module);
  // OLED
  const oled = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.36), std(C.panel));
  oled.position.set(0.12, 0.12, -0.32);
  g.add(oled);
  const oledGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.24), glow(C.cyan, 0.9));
  oledGlass.rotation.x = -Math.PI / 2;
  oledGlass.position.set(0.12, 0.16, -0.32);
  g.add(oledGlass);
  // WS2812B 12-LED ring
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 8, 8),
      glow(i % 3 === 0 ? C.cyan : C.amber, 1.1)
    );
    led.position.set(0.52 + Math.cos(a) * 0.29, 0.11, 0.24 + Math.sin(a) * 0.29);
    g.add(led);
  }
  // button
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.11, 16), std(0xdc2626));
  btn.position.set(-0.16, 0.13, 0.36);
  g.add(btn);
  // pin headers
  [-0.52, 0.52].forEach((z) => {
    for (let i = 0; i < 7; i += 1) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.055), std(C.gold, { metalness: 0.8 }));
      pin.position.set(-0.75 + i * 0.24, 0.09, z);
      g.add(pin);
    }
  });
  // Every component sits on the board's +Y face, so tilt it TOWARDS the camera.
  // A negative angle would show the blank underside instead.
  g.rotation.x = 1.2;
  g.scale.setScalar(0.92);
  return g;
}

/** MongoDB — the classic stacked-platter database icon. */
function buildDatabase() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.26, 32), std(C.mongo));
    disc.position.y = 0.34 - i * 0.34;
    g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.028, 8, 32), std(0x047857));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.34 - i * 0.34 + 0.13;
    g.add(rim);
  }
  return g;
}

/** Fitz-Bot — a small robot head. */
function buildBot() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.86, 0.82), std(C.blurple)));
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.52, 0.05), std(C.panel));
  face.position.z = 0.42;
  g.add(face);
  [-0.19, 0.19].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), glow(0xffffff, 1.1));
    eye.position.set(x, 0.03, 0.46);
    g.add(eye);
  });
  [-0.55, 0.55].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.3), std(C.darkSlate));
    ear.position.x = x;
    g.add(ear);
  });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8), std(C.darkSlate));
  stalk.position.y = 0.58;
  g.add(stalk);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), glow(C.cyan, 1.2));
  bulb.position.y = 0.78;
  g.add(bulb);
  return g;
}

/** AI worker nodes — a GPU card. */
function buildAiNodes() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.16), std(C.darkSlate)));
  [-0.42, 0.42].forEach((x) => {
    const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 10, 24), std(C.slate));
    shroud.position.set(x, 0, 0.1);
    g.add(shroud);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), glow(C.cyan, 0.75));
    fan.position.set(x, 0, 0.11);
    g.add(fan);
  });
  const pcie = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.06), std(C.gold, { metalness: 0.8 }));
  pcie.position.y = -0.46;
  g.add(pcie);
  g.rotation.x = -0.12;
  return g;
}

/** Third-party systems — a flat plaque with a coloured rim, visually "not ours". */
function buildExternal(accent = C.slate) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 0.12), std(C.panel)));
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.7), glow(accent, 0.35, { transparent: true, opacity: 0.5 }));
  inner.position.z = 0.07;
  g.add(inner);
  const rim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.62, 0.97, 0.14)),
    new THREE.LineBasicMaterial({ color: accent })
  );
  g.add(rim);
  return g;
}

/** Proxmox host — a wide rack chassis with the brand-orange bezel stripe. */
function buildProxmoxHost() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.9, 1.9), std(0x71717a, { metalness: 0.45 })));
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.9, 0.07), std(0x3f3f46));
  bezel.position.z = 0.97;
  g.add(bezel);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.12, 0.05), glow(C.proxmox, 1.1));
  stripe.position.set(0, 0.36, 1.0);
  g.add(stripe);
  for (let i = 0; i < 6; i += 1) {
    const bay = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.44, 0.04), std(0x27272a));
    bay.position.set(-2.75 + i * 1.1, -0.08, 1.01);
    g.add(bay);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), glow(C.spring, 1));
    led.position.set(-2.35 + i * 1.1, -0.08, 1.04);
    g.add(led);
  }
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(6.82, 0.92, 1.92)),
    new THREE.LineBasicMaterial({ color: C.proxmox, transparent: true, opacity: 0.6 })
  );
  g.add(wire);
  return g;
}

/** Raspberry Pi — the real board: GPIO header, SoC, USB/Ethernet stack. */
function buildRaspberryPi() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.15), std(0x0f5132, { roughness: 0.7 })));

  // 40-pin GPIO header along the top edge
  const header = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.14), std(0x111827));
  header.position.set(-0.1, 0.09, -0.45);
  g.add(header);
  for (let i = 0; i < 14; i += 1) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, 0.045), std(C.gold, { metalness: 0.85 }));
    pin.position.set(-0.68 + i * 0.095, 0.16, -0.45);
    g.add(pin);
  }

  // Broadcom SoC
  const soc = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.36), std(0x1f2937, { metalness: 0.5 }));
  soc.position.set(-0.15, 0.09, 0.02);
  g.add(soc);

  // USB + Ethernet stack down the right edge
  [0.24, -0.16].forEach((z) => {
    const usb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.19, 0.34), std(0x9ca3af, { metalness: 0.75 }));
    usb.position.set(0.66, 0.13, z);
    g.add(usb);
  });
  const eth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.21, 0.34), std(0x6b7280, { metalness: 0.75 }));
  eth.position.set(0.66, 0.14, -0.42);
  g.add(eth);

  // raspberry-red logo dab + power LEDs
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), glow(0xc51a4a, 0.8));
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(-0.62, 0.05, 0.3);
  g.add(logo);
  [0x22c55e, 0xef4444].forEach((color, i) => {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), glow(color, 1.1));
    led.position.set(-0.74 + i * 0.11, 0.07, -0.2);
    g.add(led);
  });

  g.rotation.x = 1.2; // components face the camera, same as the ESP32 board
  g.scale.setScalar(0.92);
  return g;
}

/** A VM — a lit platform its containers physically sit on. */
function buildVm(width = 5.2) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.24, 2.2),
    std(0x1e3a5f, { transparent: true, opacity: 0.8 })
  );
  g.add(slab);
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width, 0.24, 2.2)),
    new THREE.LineBasicMaterial({ color: C.cyan })
  );
  g.add(wire);
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.2, 2.0),
    glow(C.cyan, 0.5, { transparent: true, opacity: 0.16 })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.13;
  g.add(deck);
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.36, 8), glow(C.cyan, 0.9));
      post.position.set((sx * (width - 0.3)) / 2, 0.18, sz * 0.95);
      g.add(post);
    })
  );
  return g;
}

/** A Docker container — a little shipping container. */
function buildContainer() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.62, 0.66), std(C.docker)));
  for (let i = 0; i < 4; i += 1) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), std(0x1d4ed8));
    ridge.position.set(-0.27 + i * 0.18, 0, 0.34);
    g.add(ridge);
  }
  [0.34, -0.34].forEach((y) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.07, 0.7), std(0x1e40af));
    rail.position.y = y;
    g.add(rail);
  });
  return g;
}

const GEOMETRY_BUILDERS = {
  [NODE_TYPES.FRONTEND]: buildFrontend,
  [NODE_TYPES.API_SERVER]: buildApiServer,
  [NODE_TYPES.BELL_RELAY]: buildBellRelay,
  [NODE_TYPES.FIRMWARE]: buildFirmware,
  [NODE_TYPES.BOT]: buildBot,
  [NODE_TYPES.DATABASE]: buildDatabase,
  [NODE_TYPES.AI_NODES]: buildAiNodes,
  [NODE_TYPES.CONTAINER]: buildContainer,
  [NODE_TYPES.PROXMOX_HOST]: buildProxmoxHost,
  [NODE_TYPES.RASPBERRY_PI]: buildRaspberryPi,
};

function buildNodeIcon(node) {
  if (node.type === NODE_TYPES.EXTERNAL) return buildExternal(node.accent);
  if (node.type === NODE_TYPES.VM) {
    const slots = node.dockerStack?.length ?? 0;
    return buildVm(slots ? Math.max(3.2, slots * 1.35 + 0.9) : 2.8);
  }
  const builder = GEOMETRY_BUILDERS[node.type];
  return builder ? builder() : buildApiServer();
}

// ---------------------------------------------------------------------------
// Text labels (canvas sprites — always face the camera, readable in both themes)
// ---------------------------------------------------------------------------

function makeLabelSprite(text, accent = '#94a3b8', { small = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(6, 26, 500, 76, 26);
  else ctx.rect(6, 26, 500, 76);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 46px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 65, 470);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  sprite.scale.set(small ? 1.25 : 2.5, small ? 0.31 : 0.62, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function hexToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------

function findApiStatus(apiStatuses, configName) {
  return apiStatuses?.find((api) => api.name === configName) || null;
}

const TIERS = [
  { key: 'EDGE', label: 'Edge & third-party', y: TIER_Y.EDGE },
  { key: 'APP', label: 'Applications', y: TIER_Y.APP },
  { key: 'DATA', label: 'Data & workers', y: TIER_Y.DATA },
];

export default function ArchitectureGraph({ apiStatuses }) {
  const containerRef = useRef(null);
  const nodesRef = useRef([]); // [{ group, node, label, dot }]
  const edgesRef = useRef([]); // [{ edge, line, pulse, curve, from, to }]
  const pivotRef = useRef(null);
  const rotationRef = useRef({ x: -0.06, y: 0 });
  const draggingRef = useRef(false);

  const [inferredStatuses, setInferredStatuses] = useState({});
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [isDragging, setIsDragging] = useState(false);
  const { hovered, setHovered, bindPointerEvents } = useThreeHoverRaycast();

  const nodeStatuses = ALL_NODES.reduce((acc, node) => {
    acc[node.id] = deriveNodeStatus(node, apiStatuses, inferredStatuses);
    return acc;
  }, {});

  useEffect(() => {
    let cancelled = false;
    resolveInferredStatuses(ALL_NODES, apiStatuses).then((result) => {
      if (!cancelled) setInferredStatuses(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apiStatuses]);

  const toggleExpanded = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // collapsing the host collapses its VMs too, so re-opening is predictable
        if (id === 'proxmox') next.clear();
      } else {
        next.add(id);
      }
      return next;
    });

  const infraShown = expandedIds.has('proxmox');
  const toggleInfrastructure = () =>
    setExpandedIds(infraShown ? new Set() : new Set(['proxmox', 'vm-docker', 'vm-gameserver']));

  const resetView = () => {
    rotationRef.current = { x: -0.06, y: 0 };
  };

  // ---- Scene (built once) -------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 200);
    camera.position.set(0, 0, 17);
    camera.lookAt(0, 0, 0);

    const renderer = createRendererOrNull({ antialias: true, alpha: true });
    if (!renderer) {
      setWebglUnavailable(true);
      return undefined;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(5, 8, 10);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.6);
    fill.position.set(-8, -2, 6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(0, -6, -8);
    scene.add(rim);

    const pivot = new THREE.Group();
    pivotRef.current = pivot;
    scene.add(pivot);

    const offset = new THREE.Vector3(-LAYOUT_CENTER[0], -LAYOUT_CENTER[1], -LAYOUT_CENTER[2]);
    const worldPos = (p) => new THREE.Vector3(p[0], p[1], p[2]).add(offset);

    // Faint tier guides so the storeys read as storeys
    TIERS.forEach((tier) => {
      const y = tier.y + offset.y;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-8.6 + offset.x, y, -2.6),
        new THREE.Vector3(11 + offset.x, y, -2.6),
      ]);
      pivot.add(
        new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.22 }))
      );
      const tierLabel = makeLabelSprite(tier.label, '#475569');
      if (tierLabel) {
        tierLabel.scale.set(2.3, 0.58, 1);
        tierLabel.position.set(-10.1 + offset.x, y, -2.6);
        pivot.add(tierLabel);
      }
    });

    nodesRef.current = ALL_NODES.map((node, i) => {
      const group = new THREE.Group();
      group.add(buildNodeIcon(node));
      group.position.copy(worldPos(node.position));
      // The Proxmox host rides up when there are no VMs below it to make room for
      group.userData.baseYExpanded = group.position.y;
      group.userData.baseYCollapsed = HOST_TIER_TYPES.includes(node.type)
        ? HOST_COLLAPSED_Y + offset.y
        : group.position.y;
      group.userData.baseY = group.userData.baseYCollapsed;
      group.userData.targetBaseY = group.userData.baseYCollapsed;
      group.position.y = group.userData.baseY;
      group.userData.phase = i * 0.7;
      group.userData.hoverScale = 1;
      group.userData.structural = STRUCTURAL_TYPES.includes(node.type);
      group.visible = isNodeVisible(node, expandedIds);

      const label = makeLabelSprite(node.label, hexToCss(node.accent ?? 0x475569), {
        small: node.type === NODE_TYPES.CONTAINER,
      });
      if (label) {
        label.position.y = LABEL_OFFSET_Y[node.type] ?? -1.0;
        group.add(label);
      }

      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), glow(0x6b7280, 0.9));
      dot.position.y = DOT_OFFSET_Y[node.type] ?? 0.9;
      group.add(dot);
      group.userData.dot = dot;

      pivot.add(group);
      return { group, node, label };
    });

    const posById = Object.fromEntries(ALL_NODES.map((n) => [n.id, worldPos(n.position)]));
    const nodeById = Object.fromEntries(ALL_NODES.map((n) => [n.id, n]));
    const groupById = Object.fromEntries(nodesRef.current.map((n) => [n.node.id, n.group]));

    edgesRef.current = ALL_EDGES.map((edge) => {
      const kind = LINK_KINDS[edge.kind] || LINK_KINDS.http;
      const from = posById[edge.from];
      const to = posById[edge.to];

      let curve = null;
      if (edge.curve) {
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const dir = to.clone().sub(from).normalize();
        mid.add(new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(edge.curve));
        curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      }
      const points = curve ? curve.getPoints(28) : [from, to];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      const material = kind.dashed
        ? new THREE.LineDashedMaterial({
            color: kind.color,
            transparent: true,
            opacity: 0.7,
            dashSize: 0.18,
            gapSize: 0.14,
          })
        : new THREE.LineBasicMaterial({ color: kind.color, transparent: true, opacity: 0.8 });

      const line = new THREE.Line(geometry, material);
      if (kind.dashed) line.computeLineDistances();
      line.visible = isNodeVisible(nodeById[edge.from], expandedIds) && isNodeVisible(nodeById[edge.to], expandedIds);
      pivot.add(line);

      // Liveness pulse — only on real protocol links, not structural ones
      let pulse = null;
      if (!kind.dashed) {
        pulse = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), glow(kind.color, 1.4));
        pulse.visible = false;
        pivot.add(pulse);
      }
      // Host-tier machines slide up/down as the infra layer opens, so any link
      // touching one has to track its endpoints instead of baking them in.
      const dynamic =
        !curve &&
        [edge.from, edge.to].some((id) => HOST_TIER_TYPES.includes(nodeById[id]?.type));

      return {
        edge,
        line,
        pulse,
        curve,
        from,
        to,
        dynamic,
        dashed: !!kind.dashed,
        fromGroup: groupById[edge.from],
        toGroup: groupById[edge.to],
        phase: Math.random(),
      };
    });

    let animationId;
    const clock = new THREE.Clock();
    const tmpScale = new THREE.Vector3();

    const animate = () => {
      const t = clock.getElapsedTime();

      pivot.rotation.y += (rotationRef.current.y - pivot.rotation.y) * 0.12;
      pivot.rotation.x += (rotationRef.current.x - pivot.rotation.x) * 0.12;

      nodesRef.current.forEach(({ group }) => {
        const { phase, structural, targetBaseY } = group.userData;
        group.userData.baseY += (targetBaseY - group.userData.baseY) * 0.1;
        const baseY = group.userData.baseY;
        // Gentle sway instead of a full spin, so flat icons never turn edge-on
        group.rotation.y = structural ? 0 : Math.sin(t * 0.45 + phase) * 0.12;
        group.position.y = structural ? baseY : baseY + Math.sin(t * 0.75 + phase) * 0.045;
        const s = group.userData.hoverScale;
        group.scale.lerp(tmpScale.set(s, s, s), 0.16);
      });

      edgesRef.current.forEach((e) => {
        const { pulse, curve, from, to, phase } = e;
        if (e.dynamic && e.line.visible && e.fromGroup && e.toGroup) {
          from.copy(e.fromGroup.position);
          to.copy(e.toGroup.position);
          const attr = e.line.geometry.attributes.position;
          attr.setXYZ(0, from.x, from.y, from.z);
          attr.setXYZ(1, to.x, to.y, to.z);
          attr.needsUpdate = true;
          if (e.dashed) e.line.computeLineDistances();
        }
        if (pulse?.visible) {
          const p = (t * 0.3 + phase) % 1;
          if (curve) pulse.position.copy(curve.getPoint(p));
          else pulse.position.lerpVectors(from, to, p);
        }
      });

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const unbindPointerEvents = bindPointerEvents(renderer.domElement, camera, nodesRef, (entry, event) => ({
      node: entry.node,
      x: event.clientX,
      y: event.clientY,
    }));

    // ---- drag to orbit, click to select ----
    const dom = renderer.domElement;
    let last = null;
    let travelled = 0;

    const onPointerDown = (event) => {
      last = { x: event.clientX, y: event.clientY };
      travelled = 0;
      draggingRef.current = true;
      dom.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!draggingRef.current || !last) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      travelled += Math.abs(dx) + Math.abs(dy);
      if (travelled > 6) setIsDragging(true);
      rotationRef.current.y += dx * 0.006;
      rotationRef.current.x = Math.max(-0.75, Math.min(0.75, rotationRef.current.x + dy * 0.005));
      last = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event) => {
      draggingRef.current = false;
      setIsDragging(false);
      dom.releasePointerCapture?.(event.pointerId);
      if (travelled > 6) return; // that was a drag, not a click

      const rect = dom.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        nodesRef.current.filter((n) => n.group.visible).map((n) => n.group),
        true
      );
      if (!hits.length) {
        setSelectedNodeId(null);
        return;
      }
      let obj = hits[0].object;
      while (obj && !nodesRef.current.some((n) => n.group === obj)) obj = obj.parent;
      const hit = nodesRef.current.find((n) => n.group === obj);
      if (!hit) return;
      setSelectedNodeId(hit.node.id);
      if (EXPANDABLE_TYPES.includes(hit.node.type)) toggleExpanded(hit.node.id);
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);

    const unwatchTheme = watchThemeChange(() => {
      scene.background = null; // stay transparent; the CSS card supplies the backdrop
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      unbindPointerEvents();
      unwatchTheme();
      pivot.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      nodesRef.current = [];
      edgesRef.current = [];
      renderer.dispose();
      if (dom.parentNode === container) container.removeChild(dom);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Per-render sync: status colours, visibility, hover/selection --------
  useEffect(() => {
    nodesRef.current.forEach(({ group, node }) => {
      group.visible = isNodeVisible(node, expandedIds);
      group.userData.targetBaseY = expandedIds.has('proxmox')
        ? group.userData.baseYExpanded
        : group.userData.baseYCollapsed;

      const color = statusColor(nodeStatuses[node.id]);
      const dot = group.userData.dot;
      if (dot) {
        dot.material.color.setHex(color);
        dot.material.emissive.setHex(color);
      }
      const selected = node.id === selectedNodeId;
      const isHovered = hovered?.node?.id === node.id;
      group.userData.hoverScale = selected ? 1.16 : isHovered ? 1.09 : 1;
    });

    edgesRef.current.forEach(({ edge, line, pulse }) => {
      const bothVisible =
        isNodeVisible(ALL_NODES.find((n) => n.id === edge.from), expandedIds) &&
        isNodeVisible(ALL_NODES.find((n) => n.id === edge.to), expandedIds);
      line.visible = bothVisible;
      if (!pulse) return;
      const fromStatus = nodeStatuses[edge.from];
      pulse.visible = bothVisible && isOnlineish(fromStatus);
    });
  });

  const selectedNode = ALL_NODES.find((n) => n.id === selectedNodeId) || null;
  const selectedApi = selectedNode
    ? findApiStatus(apiStatuses, selectedNode.statusSource.configName)
    : null;
  const selectedLinks = selectedNode
    ? ALL_EDGES.filter(
        (e) => (e.from === selectedNode.id || e.to === selectedNode.id) && LINK_KINDS[e.kind] && e.note
      )
    : [];

  const jumpToAiNodes = () =>
    document.getElementById('ai-worker-nodes')?.scrollIntoView({ behavior: 'smooth' });

  const labelFor = (id) => ALL_NODES.find((n) => n.id === id)?.label || id;

  return (
    <div className="architecture-graph">
      <div className="architecture-graph__head">
        <div>
          <h2>Fitz-Net Architecture</h2>
          <p className="architecture-graph__hint">
            Drag to orbit · click a node for details · click the Proxmox host or a VM to drill in.
          </p>
        </div>
        <div className="architecture-graph__controls">
          <button type="button" onClick={toggleInfrastructure}>
            {infraShown ? 'Hide infrastructure' : 'Show infrastructure'}
          </button>
          <button type="button" onClick={resetView}>
            Reset view
          </button>
        </div>
      </div>

      {webglUnavailable && (
        <div className="architecture-graph__empty">
          WebGL isn't available in this browser — showing the service list instead.
        </div>
      )}

      <div
        className="architecture-graph__canvas"
        ref={containerRef}
        data-testid="architecture-graph-canvas"
      />

      {!webglUnavailable && (
        <div className="architecture-graph__legend">
          <div className="architecture-graph__legend-group">
            <span className="architecture-graph__legend-title">Status dot</span>
            {[
              NODE_STATUS.ONLINE,
              NODE_STATUS.DEGRADED,
              NODE_STATUS.OFFLINE,
              NODE_STATUS.INFERRED_ONLINE,
              NODE_STATUS.UNMONITORED,
              NODE_STATUS.EXTERNAL,
            ].map((s) => (
              <span key={s} className="architecture-graph__chip">
                <i style={{ background: hexToCss(statusColor(s)) }} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
          <div className="architecture-graph__legend-group">
            <span className="architecture-graph__legend-title">Link</span>
            {Object.entries(LINK_KINDS).map(([key, kind]) => (
              <span key={key} className="architecture-graph__chip">
                <i
                  className={kind.dashed ? 'dashed' : ''}
                  style={{ background: hexToCss(kind.color) }}
                />
                {kind.label}
              </span>
            ))}
            <span className="architecture-graph__legend-note">
              Line colour = protocol · travelling dot = link is live
            </span>
          </div>
        </div>
      )}

      {webglUnavailable && (
        <ul className="architecture-graph__fallback-list">
          {ALL_NODES.map((node) => (
            <li key={node.id} data-testid={`arch-node-${node.id}`}>
              <strong>{node.label}</strong> — {STATUS_LABEL[nodeStatuses[node.id]]}
              {node.detail?.role && ` (${node.detail.role})`}
              {node.vmId && ` — container on ${labelFor(node.vmId)}`}
            </li>
          ))}
        </ul>
      )}

      {hovered && !isDragging && (
        <div
          className="architecture-graph__tooltip"
          style={{ left: hovered.x + 14, top: hovered.y + 14 }}
        >
          <strong>{hovered.node.label}</strong>
          <div className="architecture-graph__tooltip-status">
            <i style={{ background: hexToCss(statusColor(nodeStatuses[hovered.node.id])) }} />
            {STATUS_LABEL[nodeStatuses[hovered.node.id]]}
          </div>
          {hovered.node.detail?.role && <div>{hovered.node.detail.role}</div>}
        </div>
      )}

      {selectedNode && (
        <div className="architecture-graph__detail-panel">
          <div className="card-header">
            <h2>{selectedNode.label}</h2>
            <button
              type="button"
              className="architecture-graph__close"
              onClick={() => setSelectedNodeId(null)}
              aria-label="Close details"
            >
              ✕
            </button>
          </div>

          <div className="status-section">
            <h3>Overview</h3>
            <div className="info-grid">
              <div className="info-row">
                <span className="label">Status:</span>
                <span className="value status-badge">{STATUS_LABEL[nodeStatuses[selectedNode.id]]}</span>
              </div>
              {selectedNode.detail?.repo && (
                <div className="info-row">
                  <span className="label">Repo:</span>
                  <span className="value">{selectedNode.detail.repo}</span>
                </div>
              )}
              {selectedNode.detail?.role && (
                <div className="info-row">
                  <span className="label">Role:</span>
                  <span className="value">{selectedNode.detail.role}</span>
                </div>
              )}
              {selectedNode.detail?.hostVm && (
                <div className="info-row">
                  <span className="label">Host VM:</span>
                  <span className="value">{selectedNode.detail.hostVm}</span>
                </div>
              )}
              {selectedNode.dockerStack && (
                <div className="info-row">
                  <span className="label">Containers:</span>
                  <span className="value">
                    {selectedNode.dockerStack.length
                      ? selectedNode.dockerStack.map(labelFor).join(', ')
                      : 'None — nothing deployed yet'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {selectedNode.detail?.facts?.length > 0 && (
            <div className="status-section">
              <h3>What it does</h3>
              <ul className="architecture-graph__facts">
                {selectedNode.detail.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedLinks.length > 0 && (
            <div className="status-section">
              <h3>Connections</h3>
              <ul className="architecture-graph__facts">
                {selectedLinks.map((link) => (
                  <li key={`${link.from}-${link.to}-${link.kind}`}>
                    <span
                      className="architecture-graph__link-swatch"
                      style={{ background: hexToCss(LINK_KINDS[link.kind].color) }}
                    />
                    {link.from === selectedNode.id ? '→ ' : '← '}
                    {labelFor(link.from === selectedNode.id ? link.to : link.from)}
                    <em> — {link.note}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedApi?.online && selectedApi.info?.build && (
            <div className="status-section">
              <h3>Build</h3>
              <div className="info-grid">
                <div className="info-row">
                  <span className="label">Version:</span>
                  <span className="value">{selectedApi.info.build.version}</span>
                </div>
                <div className="info-row">
                  <span className="label">Built:</span>
                  <span className="value">{new Date(selectedApi.info.build.time).toLocaleString()}</span>
                </div>
                {selectedApi.info.java?.version && (
                  <div className="info-row">
                    <span className="label">Java:</span>
                    <span className="value">{selectedApi.info.java.version}</span>
                  </div>
                )}
                {selectedApi.info.os?.name && (
                  <div className="info-row">
                    <span className="label">OS:</span>
                    <span className="value">{selectedApi.info.os.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedApi && !selectedApi.online && (
            <div className="offline-message">
              <p>❌ Currently offline or unreachable</p>
              <p className="error-detail">{selectedApi.error}</p>
            </div>
          )}

          {selectedNode.statusSource.kind === 'inferred' && (
            <p className="unavailable">
              No health endpoint of its own — status is inferred from {labelFor(selectedNode.statusSource.from)}
              's reachability.
            </p>
          )}
          {selectedNode.statusSource.kind === 'external' && (
            <p className="unavailable">Third-party service — Fitz-Net doesn't monitor it.</p>
          )}
          {selectedNode.statusSource.kind === 'unmonitored' && (
            <p className="unavailable">No live health monitoring wired up yet.</p>
          )}

          {selectedNode.jumpToAiNodes && (
            <div className="card-footer">
              <button type="button" className="architecture-graph__link-button" onClick={jumpToAiNodes}>
                Jump to AI Worker Nodes →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
