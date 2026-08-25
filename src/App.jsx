import './css/App.css';
import React, { useState, useEffect, Suspense, lazy } from 'react';
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

// These pages pull in the Three.js-based graph components and other heavy
// dependencies, so they're loaded on demand instead of in the main bundle.
const StatusDashboard = lazy(() => import('./components/StatusDashboard.jsx'));
const LiveBoard = lazy(() => import('./components/LiveBoard.jsx'));
const AiChat = lazy(() => import('./components/AiChat.jsx'));

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

    // Keep the browser chrome (address bar, task switcher) in sync with the theme
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#ffffff');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app">
      <AuthProvider>
        <BrowserRouter>
          <Navbar theme={theme} toggleTheme={toggleTheme} />
          <main className="app-main">
            <Suspense fallback={null}>
              <Routes>
                <Route path="/home" element={<Homepage />} />
                <Route index element={<Homepage />} />
                <Route path="/status" element={<StatusDashboard />} />
                <Route path="/websocket" element={<WebSocketButton />} />
                <Route path="/liveboard" element={<LiveBoard />} />
                <Route path="/ai" element={<AiChat />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/profile" element={<EditProfile />} />
                <Route path="*" element={<NoPage />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <Outlet />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
