import './css/App.css';
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Homepage from './components/Homepage.jsx';
import NoPage from './components/NoPage.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import EditProfile from './components/EditProfile.jsx';
import WebSocketButton from './components/WebSocketButton.jsx';
import StatusDashboard from './components/StatusDashboard.jsx';
import LiveBoard from './components/LiveBoard.jsx';

function App() {
  const [theme, setTheme] = useState(() => {
    // Initialize theme from localStorage or default to 'light'
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', theme);
    // Save theme preference to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app">
      <AuthProvider>
        <BrowserRouter>
          <Navbar theme={theme} toggleTheme={toggleTheme} />
          <Routes>
            <Route path="/home" element={<Homepage />} />
            <Route index element={<Homepage />} />
            <Route path="/status" element={<StatusDashboard />} />
            <Route path="/websocket" element={<WebSocketButton />} />
            <Route path="/liveboard" element={<LiveBoard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<EditProfile />} />
            <Route path="*" element={<NoPage />} />
          </Routes>
          <Footer />
          <Outlet />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
