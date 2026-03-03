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
            Welcome to Fitz-Net, a comprehensive platform ecosystem providing modern web services,
            real-time notifications, and robust backend APIs. Built with cutting-edge technologies
            and a passion for clean, responsive design.
          </p>
        </section>

        <section className="info-section">
          <h2>Our Services</h2>
          <div className="tech-grid">
            <div className="tech-item">
              <h3>🌐 Fitz-Net Website</h3>
              <p>
                The frontend portal you're using right now. Provides user authentication,
                real-time status monitoring, and WebSocket notifications. Built with React 19
                and Vite for blazing-fast performance.
              </p>
            </div>
            <div className="tech-item">
              <h3>🔧 Fitz-Net API</h3>
              <p>
                A Spring Boot backend service providing RESTful APIs for user management,
                authentication, and data persistence. Features MongoDB integration, Spring
                Security, and comprehensive health monitoring via Spring Actuator endpoints.
              </p>
            </div>
            <div className="tech-item">
              <h3>🔔 Gamerbell</h3>
              <p>
                Real-time notification service with WebSocket support. Delivers instant alerts
                and messages to connected clients. Built on Spring Boot with reactive
                programming patterns for efficient bidirectional communication.
              </p>
            </div>
          </div>
        </section>

        <section className="info-section">
          <h2>Technology Stack</h2>
          <div className="tech-grid">
            <div className="tech-item">
              <h3>⚛️ React 19</h3>
              <p>Latest React features for optimal performance</p>
            </div>
            <div className="tech-item">
              <h3>☕ Spring Boot</h3>
              <p>Enterprise-grade Java backend framework</p>
            </div>
            <div className="tech-item">
              <h3>⚡ Vite</h3>
              <p>Lightning-fast build tool and dev server</p>
            </div>
            <div className="tech-item">
              <h3>🍃 MongoDB</h3>
              <p>NoSQL database for flexible data storage</p>
            </div>
            <div className="tech-item">
              <h3>🔌 WebSockets</h3>
              <p>Real-time bidirectional communication</p>
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
            <li>🔐 Secure user authentication and authorization</li>
            <li>🔔 Real-time WebSocket notifications via Gamerbell</li>
            <li>📊 Live service health monitoring and status dashboard</li>
            <li>🌓 Dark/Light theme toggle with persistent preferences</li>
            <li>📱 Fully responsive design for all devices</li>
            <li>🚀 Fast, optimized performance across all services</li>
            <li>♿ Accessible and user-friendly interface</li>
            <li>🔒 Enterprise-grade security with Spring Security</li>
            <li>📡 RESTful API architecture with actuator endpoints</li>
          </ul>
        </section>

        <section className="info-section">
          <h2>Contact</h2>
          <p>
            Have questions or feedback? This platform is maintained by Matthew Fitzgerald.
          </p>
          <p className="contact-info">
            <strong>Website:</strong> <a href="https://fitznet.org" target="_blank" rel="noopener noreferrer">fitznet.org</a>
          </p>
        </section>

        <footer className="info-footer">
          <p className="copyright">&copy; {new Date().getFullYear()} Fitz-Net. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default InfoPanelContent;
