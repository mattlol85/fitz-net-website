import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LibrarySection from './LibrarySection.jsx';
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

const MOVIES = [
  { id: 1, title: 'Alien', year: 1979, monitored: true, hasFile: true, sizeOnDisk: 1024 },
  { id: 2, title: 'Aliens', year: 1986, monitored: false, hasFile: false, sizeOnDisk: 0 },
  { id: 3, title: 'Heat', year: 1995, monitored: true, hasFile: true, sizeOnDisk: 2048 },
];

describe('LibrarySection', () => {
  beforeEach(() => {
    mockJoenetRoutes({ 'GET movie': MOVIES.map((m) => ({ ...m })) });
  });

  it('should list the library from the movie endpoint', async () => {
    renderWithJoenet(<LibrarySection app="radarr" />);

    expect(await screen.findByText('Heat')).toBeInTheDocument();
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'movie', 'jwt', 'radarr-key', { query: undefined });
    expect(screen.getByLabelText('Monitored: Aliens')).not.toBeChecked();
  });

  it('should use the series endpoint for Sonarr', async () => {
    mockJoenetRoutes({ 'GET series': [{ id: 9, title: 'Severance', year: 2022, monitored: true, statistics: { episodeFileCount: 1, episodeCount: 2 } }] });
    renderWithJoenet(<LibrarySection app="sonarr" />);

    expect(await screen.findByText('Severance')).toBeInTheDocument();
    expect(screen.getByText('1/2 episodes')).toBeInTheDocument();
  });

  it('should filter by title and by monitored state', async () => {
    renderWithJoenet(<LibrarySection app="radarr" />);
    await screen.findByText('Heat');

    fireEvent.change(screen.getByLabelText('Search movie library'), { target: { value: 'alien' } });
    expect(screen.queryByText('Heat')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by monitored'), { target: { value: 'unmonitored' } });
    expect(screen.queryByText('Alien')).not.toBeInTheDocument();
    expect(screen.getByText('Aliens')).toBeInTheDocument();
  });

  it('should PUT the whole movie back with the monitored flag flipped', async () => {
    api.joenetRequest.mockImplementation(async (app, path, token, key, options = {}) =>
      options.method === 'PUT'
        ? { success: true, status: 202, data: {} }
        : { success: true, status: 200, data: MOVIES.map((m) => ({ ...m })) }
    );
    renderWithJoenet(<LibrarySection app="radarr" />);

    fireEvent.click(await screen.findByLabelText('Monitored: Aliens'));

    await waitFor(() => expect(screen.getByLabelText('Monitored: Aliens')).toBeChecked());
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'movie/2', 'jwt', 'radarr-key', {
      method: 'PUT',
      body: { ...MOVIES[1], monitored: true },
    });
  });

  it('should show an error and leave the toggle alone when the update fails', async () => {
    mockJoenetRoutes({
      'GET movie': MOVIES.map((m) => ({ ...m })),
      'PUT movie/2': () => ({ success: false, status: 500, message: 'boom' }),
    });
    renderWithJoenet(<LibrarySection app="radarr" />);

    fireEvent.click(await screen.findByLabelText('Monitored: Aliens'));

    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    expect(screen.getByLabelText('Monitored: Aliens')).not.toBeChecked();
  });

  it('should only delete after an in-page confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mockJoenetRoutes({
      'GET movie': MOVIES.map((m) => ({ ...m })),
      'DELETE movie/3': () => ({ success: true, status: 200, data: {} }),
    });
    renderWithJoenet(<LibrarySection app="radarr" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Heat' }));
    expect(api.joenetRequest).not.toHaveBeenCalledWith('radarr', 'movie/3', 'jwt', 'radarr-key', expect.anything());

    fireEvent.click(screen.getByLabelText('Also delete files'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(screen.queryByText('Heat')).not.toBeInTheDocument());
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'movie/3', 'jwt', 'radarr-key', {
      method: 'DELETE',
      query: { deleteFiles: 'true' },
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('should not delete when the confirm is cancelled', async () => {
    renderWithJoenet(<LibrarySection app="radarr" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Heat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Delete Heat' })).toBeInTheDocument();
    expect(api.joenetRequest).not.toHaveBeenCalledWith('radarr', 'movie/3', 'jwt', 'radarr-key', expect.objectContaining({ method: 'DELETE' }));
  });

  it('should show the error when the library cannot be loaded', async () => {
    mockJoenetRoutes({ 'GET movie': () => ({ success: false, status: 502, message: 'The Joenet host is unreachable.' }) });
    renderWithJoenet(<LibrarySection app="radarr" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The Joenet host is unreachable.');
  });
});
