import React from 'react';
import { Link } from 'react-router-dom';
import '../css/NoPage.css';

export default function NoPage() {
  return (
    <div className="no-page-container">
      <h1 className="no-page-title">404</h1>
      <p className="no-page-message">This page doesn&apos;t exist.</p>
      <Link to="/" className="no-page-link">Back to home</Link>
    </div>
  );
}
