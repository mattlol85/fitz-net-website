import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import AiNodesGraph from './AiNodesGraph';
import { fetchNodes } from '../services/nodeService';
import { createRendererOrNull } from '../utils/webgl';

vi.mock('../services/nodeService', () => ({
  fetchNodes: vi.fn(),
}));

vi.mock('../utils/webgl', () => ({
  createRendererOrNull: vi.fn(() => null),
}));

describe('AiNodesGraph Component', () => {
  beforeEach(() => {
    fetchNodes.mockReset();
    createRendererOrNull.mockReturnValue(null);
  });

  it('shows an empty state when no nodes are registered', async () => {
    fetchNodes.mockResolvedValueOnce([]);
    render(<AiNodesGraph />);

    await waitFor(() => {
      expect(screen.getByText(/no ai nodes registered yet/i)).toBeInTheDocument();
    });
  });

  it('falls back gracefully when WebGL is unavailable (as in this jsdom test environment)', async () => {
    fetchNodes.mockResolvedValueOnce([
      { id: 'n1', name: 'local-5070ti', status: 'ONLINE', models: ['qwen3:14b'], vramGb: 16 },
    ]);
    render(<AiNodesGraph />);

    await waitFor(() => {
      expect(screen.getByText(/webgl isn't available/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/local-5070ti/)).toBeInTheDocument();
  });

  it('shows an error message when the node list fails to load', async () => {
    fetchNodes.mockRejectedValueOnce(new Error('network down'));
    render(<AiNodesGraph />);

    await waitFor(() => {
      expect(screen.getByText(/couldn't load nodes: network down/i)).toBeInTheDocument();
    });
  });

  it('lists models for each node in the no-WebGL fallback', async () => {
    fetchNodes.mockResolvedValueOnce([
      { id: 'a', name: 'alpha', status: 'BUSY', models: ['m1', 'm2'] },
      { id: 'b', name: 'beta', status: 'OFFLINE' },
    ]);
    render(<AiNodesGraph />);

    expect(await screen.findByText(/\(m1, m2\)/)).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.queryByText(/No AI nodes registered yet/i)).not.toBeInTheDocument();
  });

  it('should hide the empty-state message while an error is shown', async () => {
    fetchNodes.mockRejectedValueOnce(new Error('boom'));
    render(<AiNodesGraph />);

    expect(await screen.findByText(/couldn't load nodes: boom/i)).toBeInTheDocument();
    expect(screen.queryByText(/No AI nodes registered yet/i)).not.toBeInTheDocument();
  });

  it('should not update state when the component unmounts before the list loads', async () => {
    let resolveNodes;
    fetchNodes.mockImplementationOnce(() => new Promise((resolve) => { resolveNodes = resolve; }));
    const { unmount } = render(<AiNodesGraph />);

    unmount();
    resolveNodes([{ id: 'x', name: 'late', status: 'ONLINE' }]);

    await Promise.resolve();
    expect(screen.queryByText('late')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WebGL-available path: a fake renderer, hand-stepped frames and hover hits.
// ---------------------------------------------------------------------------

function makeRenderer() {
  const domElement = document.createElement('canvas');
  domElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });
  return {
    domElement,
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('AiNodesGraph with WebGL', () => {
  let renderer;
  let frames;
  let hitIndex;

  const sampleNodes = [
    { id: 'n1', name: 'local-5070ti', status: 'ONLINE', models: ['qwen3:14b', 'qwen3-coder:30b'], vramGb: 16, lastHeartbeatAt: '2025-06-01T12:00:00Z' },
    { id: 'n2', name: 'brother-pc', status: 'BUSY', vramGb: 24 },
    { id: 'n3', name: 'laptop', status: 'WEIRD' },
  ];

  const runFrame = () => {
    frames.splice(0).forEach((cb) => cb(performance.now()));
  };

  const sceneOf = () => renderer.render.mock.calls.at(-1)[0];
  const sphereMeshes = () => sceneOf().children.filter((c) => c.isMesh && c.geometry.type === 'SphereGeometry');

  beforeEach(() => {
    fetchNodes.mockReset();
    renderer = makeRenderer();
    createRendererOrNull.mockReturnValue(renderer);
    frames = [];
    hitIndex = null;

    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
      frames.push(cb);
      return frames.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 });

    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockImplementation((objects) => {
      const target = objects[hitIndex];
      return hitIndex === null || !target ? [] : [{ object: target }];
    });
    fetchNodes.mockResolvedValue(sampleNodes);
  });

  afterEach(() => {
    // Unmount while the animation globals are still stubbed.
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete HTMLElement.prototype.clientWidth;
    delete HTMLElement.prototype.clientHeight;
  });

  it('should create the renderer and mount its canvas', async () => {
    render(<AiNodesGraph />);

    await waitFor(() => expect(renderer.render).toHaveBeenCalled());
    expect(createRendererOrNull).toHaveBeenCalledWith({ antialias: true, alpha: true });
    expect(renderer.setSize).toHaveBeenCalledWith(400, 300);
    expect(screen.getByTestId('ai-nodes-canvas').querySelector('canvas')).toBe(renderer.domElement);
    expect(screen.queryByText(/webgl isn't available/i)).not.toBeInTheDocument();
  });

  it('should add one sphere per registered node, sized by VRAM and coloured by status', async () => {
    render(<AiNodesGraph />);

    await waitFor(() => expect(sphereMeshes()).toHaveLength(3));
    const [online, busy, unknown] = sphereMeshes();
    expect(online.material.color.getHex()).toBe(0x10b981);
    expect(busy.material.color.getHex()).toBe(0xf59e0b);
    expect(unknown.material.color.getHex()).toBe(0x6b7280);
    expect(online.geometry.parameters.radius).toBeCloseTo(0.25 + 16 / 64);
    expect(unknown.geometry.parameters.radius).toBeCloseTo(0.25 + 8 / 64);
  });

  it('should replace the spheres when a refresh returns a different node list', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchNodes.mockReset().mockResolvedValueOnce(sampleNodes).mockResolvedValue([sampleNodes[0]]);
    render(<AiNodesGraph />);
    await waitFor(() => expect(sphereMeshes()).toHaveLength(3));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    await waitFor(() => expect(sphereMeshes()).toHaveLength(1));
  });

  it('should move the spheres along their orbits on each frame', async () => {
    render(<AiNodesGraph />);
    await waitFor(() => expect(sphereMeshes()).toHaveLength(3));
    const before = renderer.render.mock.calls.length;

    runFrame();

    expect(renderer.render.mock.calls.length).toBe(before + 1);
    expect(frames.length).toBeGreaterThan(0);
    expect(sphereMeshes()[0].position.length()).toBeGreaterThan(0);
  });

  it('should show a hover tooltip with status, models and heartbeat', async () => {
    render(<AiNodesGraph />);
    await waitFor(() => expect(sphereMeshes()).toHaveLength(3));

    hitIndex = 0;
    fireEvent(renderer.domElement, new MouseEvent('pointermove', { clientX: 50, clientY: 40, bubbles: true }));

    const tooltip = await screen.findByText('local-5070ti', { selector: 'strong' });
    expect(tooltip.parentElement).toHaveTextContent('Status: ONLINE');
    expect(tooltip.parentElement).toHaveTextContent('Models: qwen3:14b, qwen3-coder:30b');
    expect(tooltip.parentElement).toHaveTextContent('Last heartbeat:');
    expect(tooltip.parentElement).toHaveStyle({ left: '62px', top: '52px' });
  });

  it('should omit model and heartbeat lines when the node has none', async () => {
    render(<AiNodesGraph />);
    await waitFor(() => expect(sphereMeshes()).toHaveLength(3));

    hitIndex = 1;
    fireEvent(renderer.domElement, new MouseEvent('pointermove', { clientX: 50, clientY: 40, bubbles: true }));

    const tooltip = await screen.findByText('brother-pc', { selector: 'strong' });
    expect(tooltip.parentElement).not.toHaveTextContent('Models:');
    expect(tooltip.parentElement).not.toHaveTextContent('Last heartbeat:');
  });

  it('should resize the renderer when the window resizes', async () => {
    render(<AiNodesGraph />);
    await waitFor(() => expect(renderer.render).toHaveBeenCalled());
    renderer.setSize.mockClear();

    fireEvent(window, new Event('resize'));

    expect(renderer.setSize).toHaveBeenCalledWith(400, 300);
  });

  it('should dispose of meshes and the renderer when unmounted', async () => {
    const { unmount } = render(<AiNodesGraph />);
    await waitFor(() => expect(sphereMeshes()).toHaveLength(3));

    unmount();

    expect(renderer.dispose).toHaveBeenCalled();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('should poll the node list every 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AiNodesGraph />);
    await waitFor(() => expect(fetchNodes).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(fetchNodes).toHaveBeenCalledTimes(2);
  });

  it('should clear a previous error once a later poll succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchNodes
      .mockReset()
      .mockRejectedValueOnce(new Error('temporarily down'))
      .mockResolvedValue(sampleNodes);
    render(<AiNodesGraph />);
    expect(await screen.findByText(/temporarily down/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    await waitFor(() => expect(screen.queryByText(/temporarily down/)).not.toBeInTheDocument());
  });
});

describe('AiNodesGraph late responses and detached canvases', () => {
  beforeEach(() => {
    fetchNodes.mockReset();
    createRendererOrNull.mockReturnValue(null);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('should ignore a failed node-list request that finishes after unmount', async () => {
    let rejectNodes;
    fetchNodes.mockImplementationOnce(() => new Promise((_, reject) => { rejectNodes = reject; }));
    const { unmount } = render(<AiNodesGraph />);

    unmount();
    rejectNodes(new Error('too late'));
    await Promise.resolve();

    expect(screen.queryByText(/too late/)).not.toBeInTheDocument();
  });

  it('should tolerate the canvas having been removed before unmount', async () => {
    const domElement = document.createElement('canvas');
    domElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1, height: 1 });
    const renderer = {
      domElement,
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    createRendererOrNull.mockReturnValue(renderer);
    fetchNodes.mockResolvedValue([]);
    const { unmount } = render(<AiNodesGraph />);
    await waitFor(() => expect(fetchNodes).toHaveBeenCalled());

    domElement.remove();

    expect(() => unmount()).not.toThrow();
    expect(renderer.dispose).toHaveBeenCalled();
  });
});
