import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../css/LoginModal.css';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled):not([readonly])';

/**
 * Rounded sign-in dialog shown over a page that needs an account. It signs in through the same
 * AuthContext.login() as the /login page, so it uses the same accounts and API. It has no close
 * button: the page underneath is not usable until someone signs in.
 */
function LoginModal({ logo, siteName, registerPath = '/register' }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (error) passwordRef.current?.focus();
  }, [error]);

  const onKeyDown = (event) => {
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
    if (!username || !password || busy) return;
    setBusy(true);
    setError('');
    let result;
    try {
      result = await login(username, password);
    } catch {
      result = null;
    }
    // On success the gate re-renders without this dialog; only a failure needs the form back.
    if (!result?.success) {
      setError(result?.message || 'Could not sign in. Please try again.');
      setPassword('');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="login-modal__overlay">
      <div
        ref={cardRef}
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        onKeyDown={onKeyDown}
      >
        {logo && <img src={logo} alt={`${siteName} logo`} className="login-modal__logo" />}
        <h2 id="login-modal-title" className="login-modal__title">
          Welcome to {siteName}
        </h2>
        <p className="login-modal__text">Sign in with your Fitz-Net account to continue.</p>

        <form className="login-modal__form" onSubmit={submit} noValidate>
          <div className="login-modal__field">
            <label htmlFor="login-modal-username">Username</label>
            <input
              ref={usernameRef}
              id="login-modal-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              disabled={busy}
            />
          </div>
          <div className="login-modal__field">
            <label htmlFor="login-modal-password">Password</label>
            <input
              ref={passwordRef}
              id="login-modal-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          {error && (
            <div className="login-modal__error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="login-modal__submit" disabled={busy || !username || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-modal__footer">
          New here? <Link to={registerPath}>Create an account</Link>
        </p>
      </div>
    </div>,
    document.body
  );
}

export default LoginModal;
