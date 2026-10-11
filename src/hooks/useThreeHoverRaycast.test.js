import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { useThreeHoverRaycast } from './useThreeHoverRaycast';

// A 200x200 "canvas" at the origin with a camera looking down -Z at a unit
// sphere centred on the origin, so the screen centre hits the sphere.
function setupScene() {
  const domElement = document.createElement('div');
  domElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16));
  mesh.updateMatrixWorld();
  const node = { id: 'sphere-1', label: 'Sphere' };
  const meshesRef = { current: [{ mesh, node }] };
  return { domElement, camera, meshesRef, node };
}

const pointer = (domElement, type, clientX, clientY) => {
  domElement.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
};

describe('useThreeHoverRaycast', () => {
  it('should start with nothing hovered and expose the binder', () => {
    const { result } = renderHook(() => useThreeHoverRaycast());

    expect(result.current.hovered).toBeNull();
    expect(typeof result.current.setHovered).toBe('function');
    expect(typeof result.current.bindPointerEvents).toBe('function');
  });

  it('should report the node under the pointer with the default payload', () => {
    const { result } = renderHook(() => useThreeHoverRaycast());
    const { domElement, camera, meshesRef, node } = setupScene();

    act(() => {
      result.current.bindPointerEvents(domElement, camera, meshesRef);
    });
    act(() => pointer(domElement, 'pointermove', 100, 100));

    expect(result.current.hovered).toEqual({ node, x: 100, y: 100 });
  });

  it('should use a custom mapHit to build the tooltip payload', () => {
    const { result } = renderHook(() => useThreeHoverRaycast());
    const { domElement, camera, meshesRef, node } = setupScene();
    const mapHit = (entry) => ({ label: entry.node.label });

    act(() => {
      result.current.bindPointerEvents(domElement, camera, meshesRef, mapHit);
    });
    act(() => pointer(domElement, 'pointermove', 100, 100));

    expect(result.current.hovered).toEqual({ label: node.label });
  });

  it('should clear the hover state when the pointer is over empty space', () => {
    const { result } = renderHook(() => useThreeHoverRaycast());
    const { domElement, camera, meshesRef } = setupScene();

    act(() => {
      result.current.bindPointerEvents(domElement, camera, meshesRef);
    });
    act(() => pointer(domElement, 'pointermove', 100, 100));
    act(() => pointer(domElement, 'pointermove', 0, 0));

    expect(result.current.hovered).toBeNull();
  });

  it('should clear the hover state when the pointer leaves the element', () => {
    const { result } = renderHook(() => useThreeHoverRaycast());
    const { domElement, camera, meshesRef } = setupScene();

    act(() => {
      result.current.bindPointerEvents(domElement, camera, meshesRef);
    });
    act(() => pointer(domElement, 'pointermove', 100, 100));
    act(() => pointer(domElement, 'pointerleave', 0, 0));

    expect(result.current.hovered).toBeNull();
  });

  it('should resolve a hit on a child object to its parent group entry', () => {
    const { result } = renderHook(() => useThreeHoverRaycast());
    const { domElement, camera, node } = setupScene();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16)));
    group.updateMatrixWorld(true);
    const meshesRef = { current: [{ group, node }] };

    act(() => {
      result.current.bindPointerEvents(domElement, camera, meshesRef);
    });
    act(() => pointer(domElement, 'pointermove', 100, 100));

    expect(result.current.hovered).toEqual({ node, x: 100, y: 100 });
  });

  it('should clear the hover state when the raycast hits an object that is not tracked', () => {
    const { result } = renderHook(() => useThreeHoverRaycast());
    const { domElement, camera, meshesRef } = setupScene();
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: new THREE.Object3D() },
    ]);

    act(() => {
      result.current.bindPointerEvents(domElement, camera, meshesRef);
    });
    act(() => pointer(domElement, 'pointermove', 100, 100));

    expect(result.current.hovered).toBeNull();
    vi.restoreAllMocks();
  });

  it('should stop reacting to pointer events after cleanup', () => {
    const { result } = renderHook(() => useThreeHoverRaycast());
    const { domElement, camera, meshesRef } = setupScene();
    let cleanup;

    act(() => {
      cleanup = result.current.bindPointerEvents(domElement, camera, meshesRef);
    });
    cleanup();
    act(() => pointer(domElement, 'pointermove', 100, 100));

    expect(result.current.hovered).toBeNull();
  });
});
