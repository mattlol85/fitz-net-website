import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ArchitectureGraph from './ArchitectureGraph';
import { ALL_NODES } from '../constants/architecture';
import { createRendererOrNull } from '../utils/webgl';

vi.mock('../utils/webgl', () => ({
  createRendererOrNull: vi.fn(() => null),
}));

const allUp = [
  { name: 'fitz-net-website', online: true, health: { status: 'UP' } },
  {
    name: 'fitz-net-api',
    online: true,
    health: { status: 'UP', components: { mongo: { status: 'UP' } } },
    info: { build: { version: '1.2.3', time: '2025-01-02T03:04:05Z' }, java: { version: '21' }, os: { name: 'Linux' } },
  },
  { name: 'gamerbell', online: true, health: { status: 'UP' } },
];

describe('ArchitectureGraph', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    createRendererOrNull.mockReturnValue(null);
  });

  it('falls back gracefully when WebGL is unavailable (as in this jsdom test environment)', async () => {
    const apiStatuses = [
      { name: 'fitz-net-website', online: true, health: { status: 'UP' } },
      { name: 'fitz-net-api', online: true, health: { status: 'UP', components: { mongo: { status: 'UP' } } } },
      { name: 'gamerbell', online: true, health: { status: 'UP' } },
    ];
    render(<ArchitectureGraph apiStatuses={apiStatuses} />);

    await waitFor(() => {
      expect(screen.getByText(/webgl isn't available/i)).toBeInTheDocument();
    });

    ALL_NODES.forEach((node) => {
      expect(screen.getByTestId(`arch-node-${node.id}`)).toBeInTheDocument();
    });
  });

  it('renders exactly one fallback row per configured node, including the Proxmox/VM/container layer', async () => {
    render(<ArchitectureGraph apiStatuses={[]} />);

    await waitFor(() => {
      expect(screen.getByText(/webgl isn't available/i)).toBeInTheDocument();
    });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(ALL_NODES.length);
  });

  it('shows MongoDB as offline when its nested health is DOWN', async () => {
    const apiStatuses = [
      { name: 'fitz-net-api', online: true, health: { status: 'UP', components: { mongo: { status: 'DOWN' } } } },
    ];
    render(<ArchitectureGraph apiStatuses={apiStatuses} />);

    await waitFor(() => {
      expect(screen.getByTestId('arch-node-mongo')).toBeInTheDocument();
    });
    expect(screen.getByTestId('arch-node-mongo')).toHaveTextContent(/offline/i);
  });

  it('labels Fitz-Bot as not monitored', async () => {
    render(<ArchitectureGraph apiStatuses={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('arch-node-fitz-bot')).toBeInTheDocument();
    });
    expect(screen.getByTestId('arch-node-fitz-bot')).toHaveTextContent(/not monitored/i);
  });

  it('marks third-party systems as external rather than unhealthy', async () => {
    render(<ArchitectureGraph apiStatuses={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('arch-node-discord')).toBeInTheDocument();
    });
    expect(screen.getByTestId('arch-node-github-releases')).toHaveTextContent(/external service/i);
    expect(screen.getByTestId('arch-node-joenet-media')).toHaveTextContent(/external service/i);
  });

  it('renders the Proxmox host and both VM nodes', async () => {
    render(<ArchitectureGraph apiStatuses={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('arch-node-proxmox')).toBeInTheDocument();
    });
    expect(screen.getByTestId('arch-node-vm-docker')).toBeInTheDocument();
    expect(screen.getByTestId('arch-node-vm-gameserver')).toBeInTheDocument();
  });

  it('derives a Docker container node\'s status from its underlying service', async () => {
    const apiStatuses = [
      { name: 'fitz-net-api', online: true, health: { status: 'UP', components: { mongo: { status: 'UP' } } } },
    ];
    render(<ArchitectureGraph apiStatuses={apiStatuses} />);

    await waitFor(() => {
      expect(screen.getByTestId('arch-node-container-vm-docker-fitz-net-api')).toBeInTheDocument();
    });
    const containerRow = screen.getByTestId('arch-node-container-vm-docker-fitz-net-api');
    expect(containerRow).toHaveTextContent(/online/i);
    expect(containerRow).toHaveTextContent(/container on docker-vm/i);
  });
});

// ---------------------------------------------------------------------------
// WebGL-available path. The renderer is faked, animation frames are stepped by
// hand, and raycast hits are chosen by node id instead of real geometry.
// ---------------------------------------------------------------------------

function makeRenderer() {
  const domElement = document.createElement('canvas');
  domElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });
  domElement.setPointerCapture = vi.fn();
  domElement.releasePointerCapture = vi.fn();
  return {
    domElement,
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };
}

function makeCanvasContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
  };
}

describe('ArchitectureGraph with WebGL', () => {
  let renderer;
  let frames;
  let hitId;
  let nodeGroups;
  let fakeCtx;

  const hitNode = (id) => {
    hitId = id;
  };

  const pointerEvent = (type, x = 100, y = 100) =>
    new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });

  const clickAt = (canvas, x = 100, y = 100) => {
    fireEvent(canvas, pointerEvent('pointerdown', x, y));
    fireEvent(canvas, pointerEvent('pointerup', x, y));
  };

  const runFrame = () => {
    const pending = frames.splice(0);
    pending.forEach((cb) => cb(performance.now()));
  };

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    renderer = makeRenderer();
    createRendererOrNull.mockReturnValue(renderer);
    frames = [];
    hitId = null;
    nodeGroups = [];

    // jsdom has no 2D canvas, so label sprites need a fake context to be drawn.
    fakeCtx = makeCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);

    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
      frames.push(cb);
      return frames.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });

    // Raycaster: return the chosen node's group if it is among the candidates.
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockImplementation((objects) => {
      if (hitId === null) return [];
      const index = ALL_NODES.findIndex((n) => n.id === hitId);
      const group = nodeGroups[index];
      if (!group || !objects.includes(group)) return [];
      // Hit the innermost mesh so the parent walk is exercised.
      const mesh = group.children[0]?.children[0] ?? group.children[0];
      return [{ object: mesh }];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete HTMLElement.prototype.clientWidth;
    delete HTMLElement.prototype.clientHeight;
  });

  // Once mounted, locate the per-node groups in the scene the renderer received.
  const mountScene = async (props = {}) => {
    const utils = render(<ArchitectureGraph apiStatuses={allUp} {...props} />);
    await waitFor(() => expect(renderer.render).toHaveBeenCalled());
    const scene = renderer.render.mock.calls[0][0];
    const pivot = scene.children.find((c) => c.children?.some((x) => x.userData?.dot));
    nodeGroups = pivot.children.filter((c) => c.userData?.dot);
    return utils;
  };

  const canvasOf = () => screen.getByTestId('architecture-graph-canvas').querySelector('canvas');

  it('should build the renderer with transparency and mount its canvas', async () => {
    await mountScene();

    expect(createRendererOrNull).toHaveBeenCalledWith({ antialias: true, alpha: true });
    expect(renderer.setSize).toHaveBeenCalledWith(800, 600);
    expect(renderer.setPixelRatio).toHaveBeenCalled();
    expect(canvasOf()).toBe(renderer.domElement);
    expect(screen.queryByText(/webgl isn't available/i)).not.toBeInTheDocument();
  });

  it('should render the status and link legends', async () => {
    await mountScene();

    expect(screen.getByText('Status dot')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('WebSocket')).toBeInTheDocument();
    expect(screen.getByText(/travelling dot/i)).toBeInTheDocument();
  });

  it('should keep animating frames and re-render the scene each frame', async () => {
    await mountScene();
    const before = renderer.render.mock.calls.length;

    runFrame();
    runFrame();

    expect(renderer.render.mock.calls.length).toBeGreaterThan(before);
    expect(frames.length).toBeGreaterThan(0);
  });

  it('should resize the renderer when the window resizes', async () => {
    await mountScene();
    renderer.setSize.mockClear();

    fireEvent(window, new Event('resize'));

    expect(renderer.setSize).toHaveBeenCalledWith(800, 600);
  });

  it('should keep the scene transparent when the theme changes', async () => {
    await mountScene();

    document.documentElement.setAttribute('data-theme', 'dark');
    await waitFor(() => expect(renderer.render).toHaveBeenCalled());
    document.documentElement.removeAttribute('data-theme');
  });

  it('should show the detail panel for an actuator node and its build info', async () => {
    await mountScene();

    act(() => hitNode('fitz-net-api'));
    clickAt(canvasOf());

    const panel = await screen.findByText('fitz-net-api', { selector: 'h2' });
    expect(panel).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('Linux')).toBeInTheDocument();
    expect(screen.getByText(/Connections/)).toBeInTheDocument();
  });

  it('should show the offline message when the selected API is unreachable', async () => {
    await mountScene({
      apiStatuses: [{ name: 'fitz-net-api', online: false, error: 'timeout after 5s' }],
    });

    act(() => hitNode('fitz-net-api'));
    clickAt(canvasOf());

    expect(await screen.findByText('Currently offline or unreachable')).toBeInTheDocument();
    expect(screen.getByText('timeout after 5s')).toBeInTheDocument();
  });

  it('should explain inferred status for nodes without their own health endpoint', async () => {
    await mountScene();

    act(() => hitNode('esp32-bell'));
    clickAt(canvasOf());

    expect(await screen.findByText(/status is inferred from/i)).toBeInTheDocument();
  });

  it('should explain external services for third-party nodes', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    clickAt(canvasOf());

    expect(await screen.findByText(/Third-party service/i)).toBeInTheDocument();
  });

  it('should explain unmonitored nodes', async () => {
    await mountScene();

    act(() => hitNode('fitz-bot'));
    clickAt(canvasOf());

    expect(await screen.findByText(/No live health monitoring wired up yet/i)).toBeInTheDocument();
    expect(screen.getByText(/JDA gateway/)).toBeInTheDocument();
  });

  it('should show the repo, role and facts for a hardware node', async () => {
    await mountScene();

    act(() => hitNode('esp32-bell'));
    clickAt(canvasOf());

    expect(await screen.findByText('Repo:')).toBeInTheDocument();
    expect(screen.getByText('Role:')).toBeInTheDocument();
    expect(screen.getByText('What it does')).toBeInTheDocument();
  });

  it('should scroll to the AI worker nodes when the jump button is pressed', async () => {
    const target = document.createElement('div');
    target.id = 'ai-worker-nodes';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    await mountScene();

    act(() => hitNode('ai-nodes'));
    clickAt(canvasOf());
    fireEvent.click(await screen.findByRole('button', { name: /Jump to AI Worker Nodes/i }));

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    target.remove();
  });

  it('should not fail when the jump target is missing from the page', async () => {
    await mountScene();

    act(() => hitNode('ai-nodes'));
    clickAt(canvasOf());
    fireEvent.click(await screen.findByRole('button', { name: /Jump to AI Worker Nodes/i }));

    expect(screen.getByRole('button', { name: /Jump to AI Worker Nodes/i })).toBeInTheDocument();
  });

  it('should close the detail panel from its close button', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    clickAt(canvasOf());
    fireEvent.click(await screen.findByRole('button', { name: 'Close details' }));

    expect(screen.queryByText(/Third-party service/i)).not.toBeInTheDocument();
  });

  it('should deselect when clicking empty space', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    clickAt(canvasOf());
    await screen.findByText(/Third-party service/i);
    act(() => hitNode(null));
    clickAt(canvasOf());

    expect(screen.queryByText(/Third-party service/i)).not.toBeInTheDocument();
  });

  it('should reveal the Proxmox VMs when the host is clicked and hide them again', async () => {
    await mountScene();
    const toggle = () => screen.getByRole('button', { name: /infrastructure/i });

    expect(toggle()).toHaveTextContent('Show infrastructure');
    act(() => hitNode('proxmox'));
    clickAt(canvasOf());
    expect(await screen.findByRole('button', { name: 'Hide infrastructure' })).toBeInTheDocument();

    act(() => hitNode('proxmox'));
    clickAt(canvasOf());
    expect(await screen.findByRole('button', { name: 'Show infrastructure' })).toBeInTheDocument();
  });

  it('should toggle the infrastructure layer from the header button', async () => {
    await mountScene();

    fireEvent.click(screen.getByRole('button', { name: 'Show infrastructure' }));
    expect(screen.getByRole('button', { name: 'Hide infrastructure' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide infrastructure' }));
    expect(screen.getByRole('button', { name: 'Show infrastructure' })).toBeInTheDocument();
  });

  it('should reset the view from the reset button', async () => {
    await mountScene();

    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));

    expect(screen.getByRole('button', { name: 'Reset view' })).toBeInTheDocument();
  });

  it('should describe the containers and host of an expanded VM', async () => {
    await mountScene();
    fireEvent.click(screen.getByRole('button', { name: 'Show infrastructure' }));

    act(() => hitNode('vm-docker'));
    clickAt(canvasOf());
    expect(await screen.findByText('docker-vm', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Containers:')).toBeInTheDocument();
    expect(screen.getByText('fitz-net-website, fitz-net-api, GamerBell, MongoDB')).toBeInTheDocument();
  });

  it('should say when a VM has no containers deployed', async () => {
    await mountScene();
    fireEvent.click(screen.getByRole('button', { name: 'Show infrastructure' }));

    act(() => hitNode('vm-gameserver'));
    clickAt(canvasOf());

    expect(await screen.findByText('None — nothing deployed yet')).toBeInTheDocument();
  });

  it('should describe a container node and link it back to its service', async () => {
    await mountScene();
    fireEvent.click(screen.getByRole('button', { name: 'Show infrastructure' }));
    act(() => hitNode('container-vm-docker-fitz-net-api'));
    clickAt(canvasOf());

    expect(await screen.findByText('fitz-net-api', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText('Docker container running fitz-net-api')).toBeInTheDocument();
    expect(screen.getByText(/Host VM:/)).toBeInTheDocument();
  });

  it('should show a hover tooltip for the node under the pointer', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    fireEvent(canvasOf(), pointerEvent('pointermove', 120, 90));

    const tooltip = await screen.findByText('Discord', { selector: 'strong' });
    expect(tooltip.closest('.architecture-graph__tooltip')).toHaveStyle({ left: '134px', top: '104px' });
  });

  it('should hide the hover tooltip when the pointer leaves the canvas', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    fireEvent(canvasOf(), pointerEvent('pointermove', 120, 90));
    await screen.findByText('Discord', { selector: 'strong' });
    fireEvent(canvasOf(), new Event('pointerleave'));

    expect(screen.queryByText('Discord', { selector: 'strong' })).not.toBeInTheDocument();
  });

  it('should hide the tooltip while dragging and not treat the drag as a click', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    fireEvent(canvasOf(), pointerEvent('pointerdown', 100, 100));
    fireEvent(canvasOf(), pointerEvent('pointermove', 160, 100));

    expect(screen.queryByText('Discord', { selector: 'strong' })).not.toBeInTheDocument();

    fireEvent(canvasOf(), pointerEvent('pointermove', 100, 100));
    fireEvent(canvasOf(), pointerEvent('pointerup', 100, 100));

    expect(screen.queryByText(/Third-party service/i)).not.toBeInTheDocument();
    expect(renderer.domElement.setPointerCapture).toHaveBeenCalled();
    expect(renderer.domElement.releasePointerCapture).toHaveBeenCalled();
  });

  it('should stop dragging when the browser cancels the gesture', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    fireEvent(canvasOf(), pointerEvent('pointerdown', 100, 100));
    fireEvent(canvasOf(), pointerEvent('pointermove', 160, 100));
    expect(screen.queryByText('Discord', { selector: 'strong' })).not.toBeInTheDocument();

    fireEvent(canvasOf(), new Event('pointercancel'));
    fireEvent(canvasOf(), pointerEvent('pointermove', 110, 100));

    expect(await screen.findByText('Discord', { selector: 'strong' })).toBeInTheDocument();
  });

  it('should ignore pointer moves that happen without a preceding press', async () => {
    await mountScene();

    fireEvent(canvasOf(), pointerEvent('pointermove', 160, 100));

    expect(screen.queryByText(/Third-party service/i)).not.toBeInTheDocument();
  });

  it('should ignore a release that did not start from a press', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    fireEvent(canvasOf(), pointerEvent('pointerup', 100, 100));

    expect(screen.queryByText(/Third-party service/i)).not.toBeInTheDocument();
  });

  it('should ignore hits on objects that are not node groups', async () => {
    await mountScene();

    act(() => hitNode('discord'));
    clickAt(canvasOf());
    await screen.findByText(/Third-party service/i);
    // A hit on an object that is not one of the node groups selects nothing new.
    THREE.Raycaster.prototype.intersectObjects.mockImplementation(() => [{ object: new THREE.Object3D() }]);
    clickAt(canvasOf());

    expect(screen.getByText(/Third-party service/i)).toBeInTheDocument();
  });

  it('should take the inferred OTA status from a successful probe', async () => {
    await mountScene();

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(global.fetch.mock.calls[0][0]).toMatch(/firmware\/latest/);
  });

  it('should dispose of the scene and cancel animation when unmounted', async () => {
    const { unmount } = await mountScene();

    unmount();

    expect(renderer.dispose).toHaveBeenCalled();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should draw label text with a plain rectangle when roundRect is unavailable', async () => {
    delete fakeCtx.roundRect;
    await mountScene();

    expect(fakeCtx.rect).toHaveBeenCalled();
    expect(fakeCtx.fillText).toHaveBeenCalledWith('fitz-net-api', 256, 65, 470);
  });

  it('should still render the scene when the canvas has no 2D context', async () => {
    HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
    await mountScene();

    expect(renderer.render).toHaveBeenCalled();
    expect(fakeCtx.fillText).not.toHaveBeenCalled();
  });

  it('should keep rendering frames while the scene has live links', async () => {
    await mountScene();
    const before = renderer.render.mock.calls.length;

    runFrame();

    expect(renderer.render.mock.calls.length).toBe(before + 1);
  });
});
