import './css/App.css';
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Homepage from './components/Homepage.jsx';
import NoPage from './components/NoPage.jsx';
import Navbar from './components/Navbar.jsx';
import InfoPanelContent from './components/InfoPanelContent.jsx';
import Footer from './components/Footer.jsx';
import GreetingMessage from './components/GreetingMessage.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import WebSocketButton from './components/WebSocketButton.jsx';
import StatusDashboard from './components/StatusDashboard.jsx';

function App() {
  const [greetingShown, setGreetingShown] = useState(false);
  const [theme, setTheme] = useState(() => {
    // Initialize theme from localStorage or default to 'light'
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    // check whether the visitor has already seen the greeting message
    if (!localStorage.getItem('greetingShown')) {
      // set a cookie or local storage item to remember that the message has been shown
      localStorage.setItem('greetingShown', 'true');
      // update the state variable to show the greeting message
      setGreetingShown(true);
    }
  }, []);

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
      {greetingShown && <GreetingMessage />}
      <AuthProvider>
        <BrowserRouter>
          <Navbar theme={theme} toggleTheme={toggleTheme} />
          <Routes>
            <Route path="/home" element={<Homepage />} />
            <Route index element={<Homepage />} />
            <Route path="/info" element={<InfoPanelContent />} />
            <Route path="/status" element={<StatusDashboard />} />
            <Route path="/websocket" element={<WebSocketButton />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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