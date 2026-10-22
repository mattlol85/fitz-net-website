import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { JoenetKeyProvider } from '../../contexts/JoenetKeyContext';
import * as api from '../../services/api';

/**
 * Renders a Joenet component inside the real key provider, with the given keys
 * already verified. Tests must mock '../../contexts/AuthContext' themselves.
 */
export const renderWithJoenet = (ui, { keys = { radarr: 'radarr-key', sonarr: 'sonarr-key' }, route = '/' } = {}) => {
  window.sessionStorage.setItem('joenetKeys', JSON.stringify(keys));
  return render(
    <MemoryRouter initialEntries={[route]}>
      <JoenetKeyProvider>{ui}</JoenetKeyProvider>
    </MemoryRouter>
  );
};

/**
 * Stubs the proxy with canned responses keyed by "METHOD path". A value is
 * either response data (answered as 200) or a function returning a full result.
 * Unknown requests fail with 404 so a missed route shows up in the test.
 */
export const mockJoenetRoutes = (routes) => {
  api.joenetRequest.mockImplementation(async (app, path, token, key, options = {}) => {
    const handler = routes[`${options.method ?? 'GET'} ${path}`];
    if (handler === undefined) {
      return { success: false, status: 404, message: `Unmocked ${options.method ?? 'GET'} ${path}` };
    }
    if (typeof handler === 'function') return handler(options);
    return { success: true, status: 200, data: handler };
  });
};
