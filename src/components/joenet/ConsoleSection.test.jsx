import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConsoleSection from './ConsoleSection.jsx';
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

describe('ConsoleSection', () => {
  it('should send a GET with the typed path and show the response', async () => {
    mockJoenetRoutes({ 'GET system/status': { version: '5.1.0' } });
    renderWithJoenet(<ConsoleSection app="radarr" />);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/"version": "5.1.0"/)).toBeInTheDocument();
    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'system/status', 'jwt', 'radarr-key', { method: 'GET' });
  });

  it('should send the chosen method and a parsed JSON body', async () => {
    mockJoenetRoutes({ 'POST command': { id: 3 } });
    renderWithJoenet(<ConsoleSection app="sonarr" />);

    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'POST' } });
    fireEvent.change(screen.getByLabelText('Path'), { target: { value: 'command' } });
    fireEvent.change(screen.getByLabelText('Request body'), { target: { value: '{"name":"RssSync"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText(/"id": 3/);
    expect(api.joenetRequest).toHaveBeenCalledWith('sonarr', 'command', 'jwt', 'sonarr-key', {
      method: 'POST',
      body: { name: 'RssSync' },
    });
  });

  it('should keep paths relative to /api/v3 and keep the query string', async () => {
    mockJoenetRoutes({ 'DELETE movie/4?deleteFiles=false': {} });
    renderWithJoenet(<ConsoleSection app="radarr" />);

    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'DELETE' } });
    fireEvent.change(screen.getByLabelText('Path'), { target: { value: '/api/v3/movie/4?deleteFiles=false' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'movie/4?deleteFiles=false', 'jwt', 'radarr-key', { method: 'DELETE' })
    );
    expect(screen.queryByLabelText('Request body')).not.toBeInTheDocument();
  });

  it('should not send a request when the body is not valid JSON', () => {
    renderWithJoenet(<ConsoleSection app="radarr" />);

    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'PUT' } });
    fireEvent.change(screen.getByLabelText('Request body'), { target: { value: '{oops' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Request body is not valid JSON.');
    expect(api.joenetRequest).not.toHaveBeenCalled();
  });

  it('should show the status and message of a failed request', async () => {
    mockJoenetRoutes({ 'GET system/status': () => ({ success: false, status: 503, message: 'Joenet is not configured on the server.' }) });
    renderWithJoenet(<ConsoleSection app="radarr" />);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Joenet is not configured on the server.');
    expect(screen.getByText('Status 503')).toBeInTheDocument();
  });
});
