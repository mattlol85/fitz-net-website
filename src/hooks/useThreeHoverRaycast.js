/**
 * Shared pointer-raycast-to-hover-tooltip behavior for the three.js scenes on
 * the Status page (AiNodesGraph's orbiting spheres, ArchitectureGraph's node
 * groups). The scene itself (camera, renderer, mesh list) is only known once
 * the caller's own effect has set it up, so binding happens imperatively via
 * `bindPointerEvents` rather than through hook-managed refs.
 */
import { useCallback, useRef, useState } from 'react';
import * as THREE from 'three';

function resolveEntryForObject(object, meshesRef) {
  let obj = object;
  while (obj) {
    const entry = meshesRef.current.find((n) => n.mesh === obj || n.group === obj);
    if (entry) return entry;
    obj = obj.parent;
  }
  return null;
}

export function useThreeHoverRaycast() {
  const [hovered, setHovered] = useState(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());

  /**
   * Wire pointermove/pointerleave listeners onto `domElement`, raycasting
   * against `meshesRef.current` (each entry shaped as { mesh|group, node }).
   * `mapHit(entry, event)` builds the tooltip payload; defaults to
   * `{ node, x, y }`. Returns a cleanup function.
   */
  const bindPointerEvents = useCallback((domElement, camera, meshesRef, mapHit) => {
    const raycaster = raycasterRef.current;
    const pointer = pointerRef.current;
    const toPayload = mapHit || ((entry, event) => ({ node: entry.node, x: event.clientX, y: event.clientY }));

    const handlePointerMove = (event) => {
      const rect = domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const targets = meshesRef.current.map((n) => n.mesh ?? n.group);
      const intersects = raycaster.intersectObjects(targets, true);

      if (intersects.length > 0) {
        const entry = resolveEntryForObject(intersects[0].object, meshesRef);
        setHovered(entry ? toPayload(entry, event) : null);
      } else {
        setHovered(null);
      }
    };

    const handlePointerLeave = () => setHovered(null);

    domElement.addEventListener('pointermove', handlePointerMove);
    domElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return { hovered, setHovered, bindPointerEvents };
}
