import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AiNodesGraph from './AiNodesGraph';
import { fetchNodes } from '../services/nodeService';

vi.mock('../services/nodeService', () => ({
  fetchNodes: vi.fn(),
}));

describe('AiNodesGraph Component', () => {
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
});
