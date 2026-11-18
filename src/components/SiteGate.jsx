import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal.jsx';
import '../css/LoginModal.css';

// Pages a signed-out visitor can still reach on a gated site.
const OPEN_PATHS = ['/register'];

/**
 * Guards a whole site that needs one permission (Lori-Net needs LORINET_ACCESS). Signed out, the
 * page shows blurred behind the rounded login dialog; signed in without the permission, a card
 * says so. ADMIN passes, as everywhere else (see AuthContext.hasPermission).
 */
function SiteGate({ site, children }) {
  const { loading, isAuthenticated, hasPermission, user, logout } = useAuth();
  const { pathname } = useLocation();

  if (!site?.requiredPermission) return children;
  if (loading) return null;

  if (!isAuthenticated()) {
    if (OPEN_PATHS.includes(pathname)) return children;
    return (
      <>
        <div className="site-gate__backdrop" aria-hidden="true" inert>
          {children}
        </div>
        <LoginModal logo={site.logo} siteName={site.name} />
      </>
    );
  }

  if (!hasPermission(site.requiredPermission)) {
    return (
      <div className="site-gate__denied-wrap">
        <div className="login-modal login-modal--inline" role="alert">
          <img src={site.logo} alt={`${site.name} logo`} className="login-modal__logo" />
          <h2 className="login-modal__title">No access yet</h2>
          <p className="login-modal__text">
            You&rsquo;re signed in as <strong>{user?.username}</strong>, but this account doesn&rsquo;t have
            access to {site.name}. Ask Matt to add it for you.
          </p>
          <button type="button" className="login-modal__submit" onClick={() => logout()}>
            Sign in as someone else
          </button>
        </div>
      </div>
    );
  }

  return children;
}

export default SiteGate;
