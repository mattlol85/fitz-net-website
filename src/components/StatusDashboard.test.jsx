import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StatusDashboard from './StatusDashboard';
import packageJson from '../../package.json';

// AiNodesGraph has its own fetch/WebGL lifecycle covered by AiNodesGraph.test.jsx;
// stub it here so it doesn't consume this file's mocked global.fetch responses.
vi.mock('./AiNodesGraph', () => ({
  default: () => <div data-testid="ai-nodes-graph-stub" />,
}));

// EnrollmentTokenPanel needs an AuthProvider (via useAuth()) that this file's
// bare render(<StatusDashboard />) doesn't supply; it has its own dedicated
// test file, so stub it here too.
vi.mock('./EnrollmentTokenPanel', () => ({
  default: () => <div data-testid="enrollment-token-panel-stub" />,
}));

// Mock fetch
global.fetch = vi.fn();

describe('StatusDashboard', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('should render the dashboard title', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<StatusDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/API Status Dashboard/i)).toBeInTheDocument();
    });
  });

  it('should fetch info and health from APIs', async () => {
    const mockInfo = {
      build: {
        artifact: 'fitz-net-api',
        name: 'fitz-net-api',
        time: '2026-02-25T03:34:15.562Z',
        version: '0.3.0',
        group: 'org.fitznet',
      },
      java: { version: '21.0.10' },
      os: { name: 'Linux', version: '6.8.0-101-generic', arch: 'amd64' },
    };

    const mockHealth = {
      status: 'UP',
      components: {
        mongo: { status: 'UP' },
      },
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockInfo,
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealth,
    });
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    render(<StatusDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'fitz-net-api' })).toBeInTheDocument();
    });

    await waitFor(() => {
      // Check for the website version from embedded actuator (dynamically from package.json)
      expect(screen.getByText(new RegExp(packageJson.version))).toBeInTheDocument();
    });
  });

  it('should display offline message when API is unreachable', async () => {
    fetch.mockRejectedValue(new Error('Network error'));

    render(<StatusDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0);
    });
  });
});

