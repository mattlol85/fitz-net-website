import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../img/FN_Logo_Straight.png';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth } from '../contexts/AuthContext';
import '../css/Navbar.css';

function Navbar({ theme, toggleTheme }) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav>
      <ul>
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
        {isAuthenticated() && (
          <li>
            <Link to="/websocket">WebSocket</Link>
          </li>
        )}
        <li className="nav-spacer"></li>
        {isAuthenticated() ? (
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
