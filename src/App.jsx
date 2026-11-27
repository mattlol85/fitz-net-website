import './css/App.css';
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { JoenetKeyProvider } from './contexts/JoenetKeyContext';
import Homepage from './components/Homepage.jsx';
import NoPage from './components/NoPage.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import EditProfile from './components/EditProfile.jsx';
import WebSocketButton from './components/WebSocketButton.jsx';
import RequirePermission from './components/RequirePermission.jsx';
import SiteGate from './components/SiteGate.jsx';
import useVisualViewport from './hooks/useVisualViewport';
import { getSite } from './site';

// These pages pull in the Three.js-based graph components and other heavy
// dependencies, so they're loaded on demand instead of in the main bundle.
const StatusDashboard = lazy(() => import('./components/StatusDashboard.jsx'));
const LiveBoard = lazy(() => import('./components/LiveBoard.jsx'));
const AiChat = lazy(() => import('./components/AiChat.jsx'));
const AdminUsers = lazy(() => import('./components/AdminUsers.jsx'));
const Joenet = lazy(() => import('./components/joenet/Joenet.jsx'));
const JoenetComingSoon = lazy(() => import('./components/joenet/JoenetComingSoon.jsx'));
const JoenetAdminPanel = lazy(() => import('./components/joenet/JoenetAdminPanel.jsx'));
// Lori-Net's recipe book: its font, styles and mock data only load on /recipes.
const RecipeBox = lazy(() => import('./components/recipes/RecipeBox.jsx'));
// Lori-Net's card game: Spider Solitaire.
const SpiderSolitaire = lazy(() => import('./components/solitaire/SpiderSolitaire.jsx'));
// Marine Park's Unity web build, framed with the player's username as their in-game name.
const MarinePark = lazy(() => import('./components/MarinePark.jsx'));

function App() {
  useVisualViewport();
  const site = getSite();

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
      themeColorMeta.setAttribute('content', site.themeColor[theme === 'dark' ? 'dark' : 'light']);
    }
  }, [theme, site]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app">
      <AuthProvider>
        <JoenetKeyProvider>
          <BrowserRouter>
            <Navbar theme={theme} toggleTheme={toggleTheme} />
            <main className="app-main">
              {site.id === 'lori' ? (
                <SiteGate site={site}>
                  <Suspense fallback={null}>
                    <Routes>
                      <Route index element={<Homepage />} />
                      <Route path="/home" element={<Homepage />} />
                      <Route path="/recipes/*" element={<RecipeBox />} />
                      <Route path="/spider" element={<SpiderSolitaire />} />
                      {/* Signing in happens in the gate's dialog, so /login just lands on home. */}
                      <Route path="/login" element={<Navigate to="/" replace />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/profile" element={<EditProfile />} />
                      <Route path="*" element={<NoPage />} />
                    </Routes>
                  </Suspense>
                </SiteGate>
              ) : (
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/home" element={<Homepage />} />
                    <Route index element={<Homepage />} />
                    <Route path="/status" element={<StatusDashboard />} />
                    <Route path="/websocket" element={<WebSocketButton />} />
                    <Route path="/liveboard" element={<LiveBoard />} />
                    <Route
                      path="/ai"
                      element={
                        <RequirePermission permission="AI_USER">
                          <AiChat />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <RequirePermission permission="ADMIN">
                          <AdminUsers />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/joenet"
                      element={
                        <RequirePermission permission="JOENET_USER">
                          <Joenet />
                        </RequirePermission>
                      }
                    >
                      <Route index element={<JoenetComingSoon />} />
                      <Route path="admin" element={<JoenetAdminPanel />} />
                    </Route>
                    <Route
                      path="/marine-park"
                      element={
                        <RequirePermission permission="MARINE_PARK_GAME">
                          <MarinePark />
                        </RequirePermission>
                      }
                    />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/profile" element={<EditProfile />} />
                    <Route path="*" element={<NoPage />} />
                  </Routes>
                </Suspense>
              )}
            </main>
            <Footer />
            <Outlet />
          </BrowserRouter>
        </JoenetKeyProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
