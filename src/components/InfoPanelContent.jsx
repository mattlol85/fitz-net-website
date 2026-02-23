import React from 'react';
import '../css/InfoPanelContent.css';

function InfoPanelContent() {
  return (
    <div className="info-container">
      <div className="info-content">
        <h1 className="info-title">About Fitz-Net</h1>

        <section className="info-section">
          <h2>Welcome</h2>
          <p>
            Welcome to Fitz-Net, a modern web platform built with cutting-edge technologies
            and a passion for clean, responsive design.
          </p>
        </section>

        <section className="info-section">
          <h2>Technology Stack</h2>
          <div className="tech-grid">
            <div className="tech-item">
              <h3>⚛️ React 19</h3>
              <p>Latest React features for optimal performance</p>
            </div>
            <div className="tech-item">
              <h3>⚡ Vite</h3>
              <p>Lightning-fast build tool and dev server</p>
            </div>
            <div className="tech-item">
              <h3>🎨 Modern CSS</h3>
              <p>Custom styling with theme support</p>
            </div>
            <div className="tech-item">
              <h3>🧪 Vitest</h3>
              <p>Comprehensive testing framework</p>
            </div>
          </div>
        </section>

        <section className="info-section">
          <h2>Features</h2>
          <ul className="features-list">
            <li>🌓 Dark/Light theme toggle with persistent preferences</li>
            <li>📱 Fully responsive design for all devices</li>
            <li>🚀 Fast, optimized performance</li>
            <li>♿ Accessible and user-friendly interface</li>
            <li>🔒 Secure and modern web standards</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Contact</h2>
          <p>
            Have questions or feedback? This site is maintained by Matthew Fitzgerald.
          </p>
          <p className="contact-info">
            <strong>Website:</strong> <a href="https://fitznet.org" target="_blank" rel="noopener noreferrer">fitznet.org</a>
          </p>
        </section>

        <footer className="info-footer">
          <p>Built with ❤️ using React and Vite</p>
          <p className="copyright">&copy; {new Date().getFullYear()} Fitz-Net. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default InfoPanelContent;
