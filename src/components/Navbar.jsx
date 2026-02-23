import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../img/FN_Logo_Straight.png';
import ThemeToggle from './ThemeToggle.jsx';
import '../css/Navbar.css';

function Navbar({ theme, toggleTheme }) {
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
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
