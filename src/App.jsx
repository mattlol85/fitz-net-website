import './css/App.css';
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import Homepage from './components/Homepage.jsx';
import NoPage from './components/NoPage.jsx';
import Navbar from './components/Navbar.jsx';
import LaurenPanelContent from './components/LaurenPanelContent.jsx';
import InfoPanelContent from './components/InfoPanelContent.jsx';
import Footer from './components/Footer.jsx';
import GreetingMessage from './components/GreetingMessage.jsx';

function App() {
  const [greetingShown, setGreetingShown] = useState(false);

  useEffect(() => {
    // check whether the visitor has already seen the greeting message
    if (!localStorage.getItem('greetingShown')) {
      // set a cookie or local storage item to remember that the message has been shown
      localStorage.setItem('greetingShown', 'true');
      // update the state variable to show the greeting message
      setGreetingShown(true);
    }
  }, []);

  return (
    <div className="app">
      {greetingShown && <GreetingMessage />}
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/home" element={<Homepage />} />
          <Route index element={<Homepage />} />
          <Route path="/laurenpanel" element={<LaurenPanelContent />} />
          <Route path="/info" element={<InfoPanelContent />} />
          <Route path="*" element={<NoPage />} />
        </Routes>
        <Footer />
        <Outlet />
      </BrowserRouter>
    </div>
  );
}

export default App;
