import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../css/WebSocketButton.css';

function WebSocketButton() {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [ledOn, setLedOn] = useState(false);
  const [screenText, setScreenText] = useState('');
  const socketRef = useRef(null);
  const deviceId = `web-${user?.username || 'anonymous'}`;

  useEffect(() => {
    if (!isAuthenticated()) return;

    // Initialize WebSocket connection
    const wsUrl = import.meta.env.VITE_GAMERBELL_WS_URL || 'wss://gamerbell.fitznet.doomdns.org/ws';
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      console.log('Connected to Fitz-Net Bell server');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received event:', data);

        // Match original HTML behavior: respond to any device's button events
        if (data.deviceId && data.buttonEvent) {
          if (data.buttonEvent === 'PRESSED') {
            setIsPressed(true);
            setLedOn(true);
            setScreenText(`Device ${data.deviceId} Pressed!`);
          } else if (data.buttonEvent === 'RELEASED') {
            setIsPressed(false);
            setLedOn(false);
            setScreenText(''); // Clear the screen on release
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    // Cleanup on unmount
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [isAuthenticated, user]);

  const sendButtonEvent = (buttonEvent) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ deviceId, buttonEvent });
      socketRef.current.send(message);
      console.log('Sent:', message);
    }
  };

  const handlePress = () => {
    sendButtonEvent('PRESSED');
  };

  const handleRelease = () => {
    sendButtonEvent('RELEASED');
  };

  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div className="websocket-container">
      <div className="websocket-card">
        <h2 className="websocket-title">FitzNet Bell Web Edition</h2>

        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">
            {isConnected ? 'Connected' : 'Connecting to FitzNet websocket...'}
          </span>
        </div>

        <p className="instruction-text">Click and hold the button to send a press event.</p>

        <button
          className={`ws-button ${isPressed ? 'pressed' : ''}`}
          onMouseDown={handlePress}
          onMouseUp={handleRelease}
          onMouseLeave={handleRelease}
          onTouchStart={handlePress}
          onTouchEnd={handleRelease}
          disabled={!isConnected}
        >
          Press Me
        </button>

        <div className="output-section">
          <div className="led-container">
            <div className={`led ${ledOn ? 'on' : 'off'}`}></div>
            <span className="led-label">Status LED</span>
          </div>

          <div className="screen">
            {screenText || <span className="screen-placeholder">Waiting for button press...</span>}
          </div>
        </div>

        <div className="device-info">
          <small>Device ID: <code>{deviceId}</code></small>
        </div>
      </div>
    </div>
  );
}

export default WebSocketButton;


