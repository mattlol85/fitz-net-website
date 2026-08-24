import * as THREE from 'three';

/**
 * Attempt to create a THREE.WebGLRenderer, returning null instead of
 * throwing when WebGL isn't available (some browsers/environments throw on
 * context creation rather than gracefully degrading).
 */
export function createRendererOrNull(options) {
  try {
    return new THREE.WebGLRenderer(options);
  } catch {
    return null;
  }
}
