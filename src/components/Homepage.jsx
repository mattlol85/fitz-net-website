import React from 'react';
import '../css/Homepage.css';
import BoxLogo from './BoxLogo.jsx';

function Homepage() {
  return (
    <div className="homepage-container">
      <h1 className="homepage-title">
        <BoxLogo />
      </h1>
    </div>
  );
}

export default Homepage;
