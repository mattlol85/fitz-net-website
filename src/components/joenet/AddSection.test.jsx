import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddSection from './AddSection.jsx';
import { mockJoenetRoutes, renderWithJoenet } from './joenetTestUtils.jsx';
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

const LOOKUP = [
  { title: 'Arrival', year: 2016, tmdbId: 329865, overview: 'Aliens land.' },
  { title: 'Alien', year: 1979, tmdbId: 348, id: 5 },
];

describe('AddSection', () => {
  beforeEach(() => {
    mockJoenetRoutes({
      'GET qualityprofile': [{ id: 1, name: 'Any' }, { id: 4, name: 'HD-1080p' }],
      'GET rootfolder': [{ id: 1, path: '/media/movies' }],
      'GET movie/lookup': LOOKUP,
      'POST movie': (options) => ({ success: true, status: 201, data: { ...options.body, id: 77 } }),
    });
  });

  it('should look up a title and mark ones already in the library', async () => {
    renderWithJoenet(<AddSection app="radarr" />);
    await screen.findByLabelText('Quality profile');

    fireEvent.change(screen.getByLabelText('Search for a movie'), { target: { value: 'alien' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Arrival')).toBeInTheDocument();
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'movie/lookup', 'jwt', 'radarr-key', { query: { term: 'alien' } });
    expect(screen.getByRole('button', { name: 'Add Alien' })).toBeDisabled();
  });

  it('should add the chosen result with the selected quality profile and root folder', async () => {
    renderWithJoenet(<AddSection app="radarr" />);
    await screen.findByLabelText('Quality profile');
    fireEvent.change(screen.getByLabelText('Quality profile'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Search for a movie'), { target: { value: 'arrival' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Add Arrival' }));

    expect(await screen.findByText('Added Arrival')).toBeInTheDocument();
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'movie', 'jwt', 'radarr-key', {
      method: 'POST',
      body: expect.objectContaining({
        title: 'Arrival',
        tmdbId: 329865,
        qualityProfileId: 4,
        rootFolderPath: '/media/movies',
        monitored: true,
      }),
    });
    expect(screen.getByRole('button', { name: 'Add Arrival' })).toBeDisabled();
  });

  it('should add to Sonarr through the series endpoint', async () => {
    mockJoenetRoutes({
      'GET qualityprofile': [{ id: 1, name: 'Any' }],
      'GET rootfolder': [{ id: 1, path: '/media/tv' }],
      'GET series/lookup': [{ title: 'Silo', year: 2023, tvdbId: 403245 }],
      'POST series': (options) => ({ success: true, status: 201, data: { ...options.body, id: 8 } }),
    });
    renderWithJoenet(<AddSection app="sonarr" />);
    await screen.findByLabelText('Quality profile');
    fireEvent.change(screen.getByLabelText('Search for a series'), { target: { value: 'silo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Add Silo' }));

    await screen.findByText('Added Silo');
    expect(api.joenetRequest).toHaveBeenCalledWith('sonarr', 'series', 'jwt', 'sonarr-key', {
      method: 'POST',
      body: expect.objectContaining({ tvdbId: 403245, rootFolderPath: '/media/tv', seasonFolder: true }),
    });
  });

  it('should show the error when the add is rejected', async () => {
    mockJoenetRoutes({
      'GET qualityprofile': [{ id: 1, name: 'Any' }],
      'GET rootfolder': [{ id: 1, path: '/media/movies' }],
      'GET movie/lookup': [LOOKUP[0]],
      'POST movie': () => ({ success: false, status: 400, message: 'This movie has already been added' }),
    });
    renderWithJoenet(<AddSection app="radarr" />);
    await screen.findByLabelText('Quality profile');
    fireEvent.change(screen.getByLabelText('Search for a movie'), { target: { value: 'arrival' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Arrival' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This movie has already been added');
  });
});
