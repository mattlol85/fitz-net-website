import React, { useLayoutEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../img/FN_Logo_Straight.png';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth } from '../contexts/AuthContext';
import '../css/Navbar.css';

function Navbar({ theme, toggleTheme }) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const navRef = useRef(null);
  const authenticated = isAuthenticated();

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
        <li>
          <Link to="/" className="logo-link">
            <img src={logo} alt="Fitz-Net Logo" className="logo-img" />
          </Link>
        </li>
        <li>
          <Link to="/info">About</Link>
        </li>
        <li>
          <Link to="/status">Status</Link>
        </li>
        {authenticated && (
          <>
            <li>
              <Link to="/overwatch">Overwatch Tracker</Link>
            </li>
            <li>
              <Link to="/liveboard">&ldquo;The Board&rdquo;</Link>
            </li>
            <li>
              <Link to="/websocket">WebSocket</Link>
            </li>
          </>
        )}
        <li className="nav-spacer"></li>
        {authenticated ? (
          <>
            <li className="user-info">
              <Link to="/profile" className="username username-clickable">
                Welcome, {user?.username}
              </Link>
            </li>
            <li>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </li>
          </>
        ) : (
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
    </nav>
  );
}

export default Navbar;
