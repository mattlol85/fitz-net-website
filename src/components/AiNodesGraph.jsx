import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { fetchNodes } from '../services/nodeService';
import { createRendererOrNull } from '../utils/webgl';
import { useThreeHoverRaycast } from '../hooks/useThreeHoverRaycast';
import '../css/AiNodesGraph.css';

const STATUS_COLOR = {
  ONLINE: 0x10b981,
  BUSY: 0xf59e0b,
  OFFLINE: 0x6b7280,
};

function statusColor(status) {
  return STATUS_COLOR[status] || STATUS_COLOR.OFFLINE;
}

export default function AiNodesGraph() {
  const containerRef = useRef(null);
  const nodesRef = useRef([]); // [{ mesh, node }]
  const [nodes, setNodes] = useState([]);
  const { hovered, setHovered, bindPointerEvents } = useThreeHoverRaycast();
  const [error, setError] = useState(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Poll the node list
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const list = await fetchNodes();
        if (!cancelled) {
          setNodes(list);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Three.js scene setup (once)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 9);
    camera.lookAt(0, 0, 0);

    const renderer = createRendererOrNull({ antialias: true, alpha: true });
    if (!renderer) {
      setWebglUnavailable(true);
      return undefined;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffffff, 1.2);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const hubGeometry = new THREE.IcosahedronGeometry(0.9, 1);
    const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x4da3d9, wireframe: true });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    scene.add(hub);

    let animationId;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      hub.rotation.y = elapsed * 0.2;
      hub.rotation.x = elapsed * 0.1;

      nodesRef.current.forEach(({ mesh }, i) => {
        const angle = elapsed * 0.3 + (i / Math.max(1, nodesRef.current.length)) * Math.PI * 2;
        const radius = mesh.userData.orbitRadius;
        mesh.position.x = Math.cos(angle) * radius;
        mesh.position.z = Math.sin(angle) * radius;
        mesh.position.y = Math.sin(elapsed * 0.6 + i) * 0.3;
        mesh.rotation.y += 0.01;
      });

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const unbindPointerEvents = bindPointerEvents(renderer.domElement, camera, nodesRef);

    // Expose for the nodes-sync effect below
    container.__scene = scene;

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      unbindPointerEvents();
      nodesRef.current.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      nodesRef.current = [];
      hubGeometry.dispose();
      hubMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync node meshes whenever the fetched node list changes
  useEffect(() => {
    const container = containerRef.current;
    const scene = container?.__scene;
    if (!scene) return;

    nodesRef.current.forEach(({ mesh }) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    nodesRef.current = [];

    nodes.forEach((node, i) => {
      const size = 0.25 + Math.min(0.35, (node.vramGb || 8) / 64);
      const geometry = new THREE.SphereGeometry(size, 24, 24);
      const material = new THREE.MeshStandardMaterial({ color: statusColor(node.status) });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.orbitRadius = 3 + (i % 3) * 1.2;
      scene.add(mesh);
      nodesRef.current.push({ mesh, node });
    });
  }, [nodes]);

  return (
    <div className="ai-nodes-graph">
      <h2>AI Worker Nodes</h2>
      {error && <div className="ai-nodes-graph__error">Couldn't load nodes: {error}</div>}
      {nodes.length === 0 && !error && (
        <div className="ai-nodes-graph__empty">No AI nodes registered yet.</div>
      )}
      {webglUnavailable && (
        <div className="ai-nodes-graph__empty">
          WebGL isn't available in this browser — showing node list only.
        </div>
      )}
      <div className="ai-nodes-graph__canvas" ref={containerRef} data-testid="ai-nodes-canvas" />
      {webglUnavailable && nodes.length > 0 && (
        <ul className="ai-nodes-graph__fallback-list">
          {nodes.map((node) => (
            <li key={node.id}>
              <strong>{node.name}</strong> — {node.status}
              {node.models?.length > 0 && ` (${node.models.join(', ')})`}
            </li>
          ))}
        </ul>
      )}
      {hovered && (
        <div
          className="ai-nodes-graph__tooltip"
          style={{ left: hovered.x + 12, top: hovered.y + 12 }}
        >
          <strong>{hovered.node.name}</strong>
          <div>Status: {hovered.node.status}</div>
          {hovered.node.models?.length > 0 && <div>Models: {hovered.node.models.join(', ')}</div>}
          {hovered.node.lastHeartbeatAt && (
            <div>Last heartbeat: {new Date(hovered.node.lastHeartbeatAt).toLocaleTimeString()}</div>
          )}
        </div>
      )}
    </div>
  );
}
