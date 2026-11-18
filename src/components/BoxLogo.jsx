import React from 'react';
import { getSite } from '../site';
import '../css/BoxLogo.css';

function BoxLogo() {
  return (
    <div>
      <img src={getSite().animation} alt={`${getSite().name} Logo`} className="logo" />
    </div>
  );
}

export default BoxLogo;