import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import StatusDashboard from './StatusDashboard';
import packageJson from '../../package.json';

// AiNodesGraph and ArchitectureGraph each have their own fetch/WebGL
// lifecycle covered by their own test files; stub them here so they don't
// consume this file's mocked global.fetch responses. ArchitectureGraph's
// stub renders the apiStatuses prop as JSON so this file can still assert
// StatusDashboard's fetch/polling behavior fed it the right data.
vi.mock('./AiNodesGraph', () => ({
  default: () => <div data-testid="ai-nodes-graph-stub" />,
}));
vi.mock('./ArchitectureGraph', () => ({
  default: ({ apiStatuses }) => (
    <div data-testid="architecture-graph-stub">{JSON.stringify(apiStatuses)}</div>
  ),
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
      // fitz-net-api's fetched health/build info should reach ArchitectureGraph as a prop
      expect(screen.getByTestId('architecture-graph-stub')).toHaveTextContent('"name":"fitz-net-api"');
      expect(screen.getByTestId('architecture-graph-stub')).toHaveTextContent('"online":true');
    });

    await waitFor(() => {
      // Check for the website version from embedded actuator (dynamically from package.json)
      expect(screen.getByTestId('architecture-graph-stub')).toHaveTextContent(packageJson.version);
    });
  });

  it('should mark an API offline when unreachable', async () => {
    fetch.mockRejectedValue(new Error('Network error'));

    render(<StatusDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('architecture-graph-stub')).toHaveTextContent('"online":false');
    });
  });
});

describe('StatusDashboard endpoint handling', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should call the absolute actuator URLs in production builds', async () => {
    vi.stubEnv('PROD', true);
    fetch.mockImplementation(async (url) => ({
      ok: true,
      json: async () => (url.endsWith('/info') ? { build: { version: '9.9.9' } } : { status: 'UP' }),
    }));

    render(<StatusDashboard />);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('https://api.fitznet.doomdns.org/actuator/info', expect.anything())
    );
    expect(fetch).toHaveBeenCalledWith('https://gamerbell.fitznet.doomdns.org/actuator/health', expect.anything());
  });

  it('should record a service as having no health when its health endpoint errors', async () => {
    fetch.mockImplementation(async (url) => (
      url.endsWith('/health')
        ? { ok: false, status: 503 }
        : { ok: true, json: async () => ({ build: { version: '1.0.0' } }) }
    ));

    render(<StatusDashboard />);

    await waitFor(() => expect(screen.getByTestId('architecture-graph-stub').textContent).toContain('"health":null'));
    expect(screen.getByTestId('architecture-graph-stub').textContent).toContain('"info":{"build":{"version":"1.0.0"}}');
  });

  it('should record a service as having no info when its info endpoint errors', async () => {
    fetch.mockImplementation(async (url) => (
      url.endsWith('/info')
        ? { ok: false, status: 500 }
        : { ok: true, json: async () => ({ status: 'UP' }) }
    ));

    render(<StatusDashboard />);

    await waitFor(() => expect(screen.getByTestId('architecture-graph-stub').textContent).toContain('"info":null'));
  });
});

describe('StatusDashboard unexpected failures', () => {
  afterEach(() => {
    vi.doUnmock('../constants');
    vi.resetModules();
  });

  it('should show an error banner when the status refresh itself fails', async () => {
    vi.resetModules();
    vi.doMock('../constants', () => ({
      API_CONFIGS: { map: () => { throw new Error('config exploded'); } },
    }));
    vi.doMock('./AiNodesGraph', () => ({ default: () => null }));
    vi.doMock('./ArchitectureGraph', () => ({ default: () => null }));
    vi.doMock('./EnrollmentTokenPanel', () => ({ default: () => null }));
    const { default: Dashboard } = await import('./StatusDashboard');

    render(<Dashboard />);

    expect(await screen.findByText('Error loading statuses: config exploded')).toBeInTheDocument();
  });
});
