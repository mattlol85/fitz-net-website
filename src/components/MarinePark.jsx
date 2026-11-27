import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MARINE_PARK_URL } from '../constants';
import '../css/MarinePark.css';

/**
 * Where the game page lives, with the player's Fitz-Net username as `?name=`. The game reads that
 * parameter to fill its "What's your name?" box (and cleans it up to its own 3-16 letters/digits rule).
 */
export function buildGameUrl(base, username, origin = window.location.origin) {
  const url = new URL(base, origin);
  if (username) url.searchParams.set('name', username);
  return url.toString();
}

/**
 * Checks the game is installed before framing it. A same-origin path that isn't there would
 * otherwise come back as this site's own index.html (SPA fallback) and nest Fitz-Net in itself.
 * Cross-origin builds can't be probed without CORS, so those are framed as-is.
 */
async function probeGame(url) {
  if (url.origin !== window.location.origin) return true;
  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return false;
    const html = await res.text();
    return html.includes('unity-canvas');
  } catch {
    return false;
  }
}

function MarinePark() {
  const { user } = useAuth();
  const username = user?.username ?? '';
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    probeGame(new URL(MARINE_PARK_URL, window.location.origin)).then((ok) => {
      if (!cancelled) setStatus(ok ? 'ready' : 'missing');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="marine-park marine-park--message" role="status">
        <p>Loading Marine Park&hellip;</p>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="marine-park marine-park--message">
        <h1 className="marine-park__title">Marine Park</h1>
        <p>The game isn&rsquo;t installed on this server yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="marine-park">
      <iframe
        // A new name means a new game page, so the menu picks it up on load.
        key={username}
        className="marine-park__frame"
        src={buildGameUrl(MARINE_PARK_URL, username)}
        title="Marine Park"
        allow="fullscreen; autoplay; gamepad"
        allowFullScreen
      />
    </div>
  );
}

export default MarinePark;
