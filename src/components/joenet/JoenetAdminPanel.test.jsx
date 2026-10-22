import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JoenetAdminPanel from './JoenetAdminPanel.jsx';
import { mockJoenetRoutes, renderWithJoenet } from './joenetTestUtils.jsx';
import * as AuthContext from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('JoenetAdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    AuthContext.useAuth.mockReturnValue({ token: 'jwt', loading: false });
    mockJoenetRoutes({
      'GET system/status': { version: '5.1.0', osName: 'debian', branch: 'main' },
      'GET health': [],
      'GET diskspace': [],
    });
  });

  it('should show only the key gate until a key is verified', () => {
    renderWithJoenet(<JoenetAdminPanel />, { keys: {} });

    expect(screen.getByLabelText('Radarr API key')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Radarr' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Library' })).not.toBeInTheDocument();
  });

  it('should offer only the apps with a verified key', async () => {
    renderWithJoenet(<JoenetAdminPanel />, { keys: { sonarr: 'k' } });

    expect(screen.getByRole('tab', { name: 'Sonarr' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Radarr' })).not.toBeInTheDocument();
    expect(await screen.findByText('5.1.0')).toBeInTheDocument();
  });

  it('should switch between apps and sections', async () => {
    renderWithJoenet(<JoenetAdminPanel />);

    fireEvent.click(screen.getByRole('tab', { name: 'Sonarr' }));
    fireEvent.click(screen.getByRole('tab', { name: 'API Console' }));

    expect(screen.getByRole('tab', { name: 'Sonarr' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByLabelText('Path')).toBeInTheDocument();
  });

  it('should hide the panels again once the keys are forgotten', async () => {
    renderWithJoenet(<JoenetAdminPanel />);
    expect(screen.getByRole('tab', { name: 'Radarr' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Forget keys' }));

    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Radarr' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Radarr API key')).toBeInTheDocument();
  });
});
