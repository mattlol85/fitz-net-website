import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarinePark, { buildGameUrl } from './MarinePark.jsx';
import * as AuthContext from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const GAME_PAGE = '<!DOCTYPE html><canvas id="unity-canvas"></canvas>';

const respondWith = (body, ok = true) =>
  vi.fn(async () => ({ ok, text: async () => body }));

const renderAs = (username) => {
  AuthContext.useAuth.mockReturnValue({ user: username ? { username } : null });
  return render(<MarinePark />);
};

describe('buildGameUrl', () => {
  it('should put the username in the name parameter', () => {
    expect(buildGameUrl('/marine-park/index.html', 'matt', 'https://fitznet.org'))
      .toBe('https://fitznet.org/marine-park/index.html?name=matt');
  });

  it('should encode usernames that are not URL safe', () => {
    const url = new URL(buildGameUrl('/marine-park/index.html', 'big fish&co', 'https://fitznet.org'));
    expect(url.searchParams.get('name')).toBe('big fish&co');
  });

  it('should keep parameters already on the configured URL', () => {
    const url = new URL(buildGameUrl('https://games.example.com/mp/?v=2', 'matt', 'https://fitznet.org'));
    expect(url.origin).toBe('https://games.example.com');
    expect(url.searchParams.get('v')).toBe('2');
    expect(url.searchParams.get('name')).toBe('matt');
  });

  it('should leave the name parameter off when there is no username', () => {
    expect(buildGameUrl('/marine-park/index.html', '', 'https://fitznet.org'))
      .toBe('https://fitznet.org/marine-park/index.html');
  });
});

describe('MarinePark', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('should show a loading message while it checks the game is installed', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderAs('matt');
    expect(screen.getByRole('status')).toHaveTextContent('Loading Marine Park');
  });

  it('should frame the game with the Fitz-Net username as the player name', async () => {
    vi.stubGlobal('fetch', respondWith(GAME_PAGE));
    renderAs('matt');

    const frame = await screen.findByTitle('Marine Park');
    const src = new URL(frame.getAttribute('src'));
    expect(src.pathname).toBe('/marine-park/index.html');
    expect(src.searchParams.get('name')).toBe('matt');
    expect(frame.getAttribute('allow')).toContain('clipboard-write');
    expect(frame).toHaveAttribute('allowfullscreen');
  });

  it('should probe the game page without the username', async () => {
    const fetchMock = respondWith(GAME_PAGE);
    vi.stubGlobal('fetch', fetchMock);
    renderAs('matt');
    await screen.findByTitle('Marine Park');

    expect(fetchMock.mock.calls[0][0]).toBe(`${window.location.origin}/marine-park/index.html`);
  });

  it('should say the game is not installed when the page is missing', async () => {
    vi.stubGlobal('fetch', respondWith('Not found', false));
    renderAs('matt');

    expect(await screen.findByText(/isn.t installed on this server yet/)).toBeInTheDocument();
    expect(screen.queryByTitle('Marine Park')).not.toBeInTheDocument();
  });

  it('should say the game is not installed when the site answers with its own page', async () => {
    vi.stubGlobal('fetch', respondWith('<!DOCTYPE html><div id="root"></div>'));
    renderAs('matt');

    expect(await screen.findByText(/isn.t installed on this server yet/)).toBeInTheDocument();
  });

  it('should say the game is not installed when the check fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    renderAs('matt');

    expect(await screen.findByText(/isn.t installed on this server yet/)).toBeInTheDocument();
  });
});
