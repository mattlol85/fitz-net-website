import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ArchitectureGraph from './ArchitectureGraph';
import { ALL_NODES } from '../constants/architecture';

describe('ArchitectureGraph', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
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
