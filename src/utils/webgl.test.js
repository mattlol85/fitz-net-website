import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createRendererOrNull } from './webgl';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, WebGLRenderer: vi.fn() };
});

describe('createRendererOrNull', () => {
  beforeEach(() => {
    THREE.WebGLRenderer.mockReset();
  });

  it('should return a renderer when WebGL is available', () => {
    const renderer = { domElement: {} };
    THREE.WebGLRenderer.mockImplementation(function () { return renderer; });

    expect(createRendererOrNull({ antialias: true })).toBe(renderer);
    expect(THREE.WebGLRenderer).toHaveBeenCalledWith({ antialias: true });
  });

  it('should return null instead of throwing when WebGL context creation fails', () => {
    THREE.WebGLRenderer.mockImplementation(function () {
      throw new Error('no webgl');
    });

    expect(createRendererOrNull()).toBeNull();
  });
});
