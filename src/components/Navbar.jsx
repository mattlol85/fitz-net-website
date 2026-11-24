import React, { useLayoutEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth } from '../contexts/AuthContext';
import { getSite } from '../site';
import '../css/Navbar.css';

function Navbar({ theme, toggleTheme }) {
  const { user, logout, isAuthenticated, hasPermission } = useAuth();
  const navigate = useNavigate();
  const navRef = useRef(null);
  const authenticated = isAuthenticated();
  const site = getSite();
  // Lori-Net is its own gated site: no Fitz-Net feature links (it has Home, Recipes and Spider once signed
  // in), and signing in happens in its dialog.
  const isFitzNet = site.id === 'fitznet';

  useLayoutEffect(() => {
    const updateNavbarHeight = () => {
      const height = navRef.current?.getBoundingClientRect().height;

      if (height) {
        document.documentElement.style.setProperty('--navbar-height', `${Math.ceil(height)}px`);
      }
    };

    updateNavbarHeight();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateNavbarHeight)
      : null;

    if (resizeObserver && navRef.current) {
      resizeObserver.observe(navRef.current);
    }

    window.addEventListener('resize', updateNavbarHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateNavbarHeight);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav ref={navRef} className="site-nav">
      <ul className={`site-nav-list ${authenticated ? 'site-nav-list--authenticated' : 'site-nav-list--guest'}`}>
        {/* Primary links wrap inside their own group so a long link list can
            never push the auth controls off the first row. */}
        <li className="nav-primary">
          <ul className="nav-primary-list">
            <li>
              <Link to="/" className="logo-link">
                <img src={site.logo} alt={`${site.name} Logo`} className="logo-img" />
              </Link>
            </li>
            {!isFitzNet && authenticated && (
              <>
                <li className="nav-link--home">
                  <Link to="/">Home</Link>
                </li>
                <li>
                  <Link to="/recipes">Recipes</Link>
                </li>
                <li>
                  <Link to="/spider">Spider</Link>
                </li>
              </>
            )}
            {isFitzNet && (
              <>
                <li>
                  <Link to="/status">Status</Link>
                </li>
                {authenticated && (
                  <>
                    <li>
                      <Link to="/liveboard">&ldquo;The Board&rdquo;</Link>
                    </li>
                    <li>
                      <Link to="/websocket">WebSocket</Link>
                    </li>
                  </>
                )}
                {authenticated && hasPermission?.('AI_USER') && (
                  <li>
                    <Link to="/ai">Matt-GPT</Link>
                  </li>
                )}
                {authenticated && hasPermission?.('JOENET_USER') && (
                  <li>
                    <Link to="/joenet">Joenet</Link>
                  </li>
                )}
                {authenticated && hasPermission?.('ADMIN') && (
                  <li>
                    <Link to="/admin">Admin</Link>
                  </li>
                )}
              </>
            )}
          </ul>
        </li>
        <li className="nav-spacer"></li>
        {/* Every auth control lives in one non-wrapping group pinned to the
            right edge, so Login/Sign Up stay in the top-right corner instead
            of breaking apart onto a second row at narrow widths. */}
        <li className="nav-auth">
          <ul className="nav-auth-list">
            {authenticated ? (
              <>
                <li className="user-info">
                  <Link to="/profile" className="username username-clickable">
                    <span className="username__greeting">Welcome, </span>
                    {user?.username}
                  </Link>
                </li>
                <li>
                  <button onClick={handleLogout} className="logout-button">
                    Logout
                  </button>
                </li>
              </>
            ) : isFitzNet && (
              <>
                <li>
                  <Link to="/login">Login</Link>
                </li>
                <li>
                  <Link to="/register">Sign Up</Link>
                </li>
              </>
            )}
            <li>
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
