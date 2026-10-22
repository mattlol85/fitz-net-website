import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarSection from './CalendarSection.jsx';
import { renderWithJoenet } from './joenetTestUtils.jsx';
import * as AuthContext from '../../contexts/AuthContext';
import * as api from '../../services/api';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  AuthContext.useAuth.mockReturnValue({ token: 'jwt', loading: false });
});

describe('CalendarSection', () => {
  it('should list upcoming movies and the wanted list for Radarr', async () => {
    api.joenetRequest.mockImplementation(async (app, path) => ({
      success: true,
      status: 200,
      data: path === 'calendar' ? [{ id: 1, title: 'Dune', digitalRelease: '2026-11-01T00:00:00Z' }] : { records: [{ id: 2, title: 'Heat', inCinemas: '1995-12-15T00:00:00Z' }] },
    }));
    renderWithJoenet(<CalendarSection app="radarr" />);

    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(await screen.findByText('Heat')).toBeInTheDocument();
    const calendarCall = api.joenetRequest.mock.calls.find(([, path]) => path === 'calendar');
    expect(calendarCall[4].query.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should label Sonarr episodes with their series', async () => {
    api.joenetRequest.mockImplementation(async (app, path) => ({
      success: true,
      status: 200,
      data:
        path === 'calendar'
          ? [{ id: 1, title: 'Pilot', seasonNumber: 1, episodeNumber: 2, airDateUtc: '2026-11-01T00:00:00Z', series: { title: 'Silo' } }]
          : { records: [] },
    }));
    renderWithJoenet(<CalendarSection app="sonarr" />);

    expect(await screen.findByText(/Silo - S01E02 Pilot/)).toBeInTheDocument();
    expect(await screen.findByText('Nothing is missing.')).toBeInTheDocument();
  });
});
