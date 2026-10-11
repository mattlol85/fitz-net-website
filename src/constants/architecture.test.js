import { describe, expect, it } from 'vitest';
import {
  ALL_EDGES,
  ALL_NODES,
  LINK_KINDS,
  NODE_STATUS,
  STATUS_COLOR,
  buildContainerNodes,
  statusColor,
} from './architecture';

describe('architecture constants', () => {
  it('should give every node a unique id', () => {
    const ids = ALL_NODES.map((n) => n.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should only link edges between nodes that exist', () => {
    const ids = new Set(ALL_NODES.map((n) => n.id));

    ALL_EDGES.forEach((edge) => {
      expect(ids.has(edge.from), `missing from: ${edge.from}`).toBe(true);
      expect(ids.has(edge.to), `missing to: ${edge.to}`).toBe(true);
    });
  });

  it('should only use link kinds that are defined in the legend', () => {
    ALL_EDGES.forEach((edge) => {
      expect(LINK_KINDS[edge.kind]).toBeDefined();
    });
  });

  it('should give every container a VM host and a service it mirrors', () => {
    const containers = ALL_NODES.filter((n) => n.isContainer);

    expect(containers.length).toBeGreaterThan(0);
    containers.forEach((container) => {
      expect(ALL_NODES.some((n) => n.id === container.vmId)).toBe(true);
      expect(ALL_NODES.some((n) => n.id === container.serviceId)).toBe(true);
    });
  });

  it('should map known statuses to their colour', () => {
    expect(statusColor(NODE_STATUS.ONLINE)).toBe(STATUS_COLOR[NODE_STATUS.ONLINE]);
  });

  it('should fall back to the unknown colour for unrecognised statuses', () => {
    expect(statusColor('NOT_A_STATUS')).toBe(STATUS_COLOR[NODE_STATUS.UNKNOWN]);
    expect(statusColor(undefined)).toBe(STATUS_COLOR[NODE_STATUS.UNKNOWN]);
  });

  it('should label a container with its service name when the service is known', () => {
    const [container] = buildContainerNodes({
      id: 'vm-x',
      position: [0, 0, 0],
      dockerStack: ['fitz-net-api'],
    });

    expect(container.label).toBe('fitz-net-api');
    expect(container.statusSource.kind).toBe('actuator');
  });

  it('should fall back to the raw service id and an unmonitored status for unknown services', () => {
    const [container] = buildContainerNodes({
      id: 'vm-x',
      position: [0, 0, 0],
      dockerStack: ['mystery-service'],
    });

    expect(container.label).toBe('mystery-service');
    expect(container.statusSource).toEqual({ kind: 'unmonitored' });
    expect(container.detail.role).toBe('Docker container running mystery-service');
  });
});
