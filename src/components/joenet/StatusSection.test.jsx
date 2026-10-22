import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StatusSection from './StatusSection.jsx';
import { mockJoenetRoutes, renderWithJoenet } from './joenetTestUtils.jsx';
import * as AuthContext from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  AuthContext.useAuth.mockReturnValue({ token: 'jwt', loading: false });
});

describe('StatusSection', () => {
  it('should show version, health issues and disk space', async () => {
    mockJoenetRoutes({
      'GET system/status': { version: '5.14.0', osName: 'debian', branch: 'main', startTime: '2026-10-01T00:00:00Z' },
      'GET health': [{ type: 'warning', message: 'Indexers unavailable' }],
      'GET diskspace': [{ path: '/media', label: 'media', freeSpace: 1024 ** 3, totalSpace: 4 * 1024 ** 3 }],
    });
    renderWithJoenet(<StatusSection app="radarr" />);

    expect(await screen.findByText('5.14.0')).toBeInTheDocument();
    expect(screen.getByText('Indexers unavailable')).toBeInTheDocument();
    expect(screen.getByText('media: 1.0 GB free of 4.0 GB')).toBeInTheDocument();
  });

  it('should report a healthy system', async () => {
    mockJoenetRoutes({ 'GET system/status': {}, 'GET health': [], 'GET diskspace': [] });
    renderWithJoenet(<StatusSection app="sonarr" />);

    expect(await screen.findByText('No health issues.')).toBeInTheDocument();
  });

  it('should show an error when the status call fails', async () => {
    mockJoenetRoutes({
      'GET system/status': () => ({ success: false, status: 502, message: 'The Joenet host is unreachable.' }),
      'GET health': [],
      'GET diskspace': [],
    });
    renderWithJoenet(<StatusSection app="radarr" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The Joenet host is unreachable.');
  });
});
