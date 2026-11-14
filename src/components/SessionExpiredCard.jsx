import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../css/SessionExpiredCard.css';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled):not([readonly])';

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * Shown when the sign-in token runs out while a page is open. Signing in again here keeps the page
 * as it is, and requests that were waiting for a new token go through; "Sign out" ends the
 * session. It cannot be dismissed otherwise: nothing that needs the account works until one of the
 * two happens.
 */
function SessionExpiredCard({ username, onSignIn, onSignOut }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    passwordRef.current?.focus();
    return () => {
      if (previous && previous !== document.body && document.contains(previous)) previous.focus?.();
    };
  }, []);

  // Back to the (re-enabled) password field after a failed attempt.
  useEffect(() => {
    if (error) passwordRef.current?.focus();
  }, [error]);

  const onKeyDown = (event) => {
    // Keep page shortcuts (Ctrl+K, Esc on a dialog underneath) from acting behind the card.
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const items = [...cardRef.current.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    let result;
    try {
      result = await onSignIn(password);
    } catch {
      result = null;
    }
    // On success the card closes; only a failure needs the form back.
    if (!result?.success) {
      setError(result?.message || 'Could not sign in. Please try again.');
      setPassword('');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="session-card__overlay">
      <div
        ref={cardRef}
        className="session-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-card-title"
        aria-describedby="session-card-text"
        onKeyDown={onKeyDown}
      >
        <div className="session-card__icon">
          <LockIcon />
        </div>
        <h2 id="session-card-title" className="session-card__title">
          Your session has expired
        </h2>
        <p id="session-card-text" className="session-card__text">
          Sign in again to pick up where you left off. Nothing on this page is lost, and anything that
          was saving goes through once you are back.
        </p>

        <form className="session-card__form" onSubmit={submit} noValidate>
          <div className="session-card__field">
            <label htmlFor="session-card-username">Username</label>
            <input id="session-card-username" type="text" value={username} readOnly autoComplete="username" />
          </div>
          <div className="session-card__field">
            <label htmlFor="session-card-password">Password</label>
            <input
              ref={passwordRef}
              id="session-card-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          {error && (
            <div className="session-card__error" role="alert">
              {error}
            </div>
          )}

          <div className="session-card__actions">
            <button type="button" className="session-card__button session-card__button--secondary" onClick={onSignOut} disabled={busy}>
              Sign out
            </button>
            <button type="submit" className="session-card__button session-card__button--primary" disabled={busy || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default SessionExpiredCard;
