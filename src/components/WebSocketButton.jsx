import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GamerBellWidget from './GamerBellWidget';
import '../css/WebSocketButton.css';

function buildGamerbellWsUrl() {
  const host = window.location.hostname;
  if (host === 'localhost' || host.startsWith('127.')) {
    return 'ws://localhost:8080/ws';
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = host.replace(/^www\./, '');
  return `${proto}//gamerbell.${base}/ws`;
}

function WebSocketButton() {
  const { user, isAuthenticated } = useAuth();
  const isUserAuthenticated = isAuthenticated();
  const [connectionState, setConnectionState] = useState('connecting');
  const [isPressed, setIsPressed] = useState(false);
  const [localPressed, setLocalPressed] = useState(false);
  const [ledOn, setLedOn] = useState(false);
  const [screenText, setScreenText] = useState('');
  const socketRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const deviceId = user?.username || 'anonymous';
  const isConnected = connectionState === 'connected';

  const cleanupSocket = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const currentSocket = socketRef.current;
    if (currentSocket) {
      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;

      if (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING) {
        currentSocket.close();
      }

      socketRef.current = null;
    }
  }, []);

  const initializeSocket = useCallback(() => {
    if (!isUserAuthenticated || isUnmountingRef.current) {
      return;
    }

    cleanupSocket();
    setConnectionState('connecting');

    const socket = new WebSocket(buildGamerbellWsUrl());
    socketRef.current = socket;
    let hasHandledFailure = false;

    const handleSocketFailure = () => {
      if (hasHandledFailure || isUnmountingRef.current) {
        return;
      }

      hasHandledFailure = true;
      setIsPressed(false);
      setLocalPressed(false);
      setLedOn(false);
      setScreenText('');

      if (retryCountRef.current < 3) {
        const nextRetryCount = retryCountRef.current + 1;
        retryCountRef.current = nextRetryCount;
        setConnectionState('connecting');
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          initializeSocket();
        }, nextRetryCount * 2000);
        return;
      }

      setConnectionState('error');
    };

    socket.onopen = () => {
      retryCountRef.current = 0;
      setConnectionState('connected');
      console.log('Connected to Fitz-Net Bell server');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received event:', data);

        if (data.deviceId && data.buttonEvent) {
          if (data.buttonEvent === 'PRESSED') {
            setIsPressed(true);
            setLedOn(true);
            setScreenText(`Device ${data.deviceId} Pressed!`);
          } else if (data.buttonEvent === 'RELEASED') {
            setIsPressed(false);
            setLedOn(false);
            setScreenText('');
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      handleSocketFailure();
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      handleSocketFailure();
    };
  }, [cleanupSocket, isUserAuthenticated]);

  useEffect(() => {
    isUnmountingRef.current = false;

    if (!isUserAuthenticated) {
      return () => {
        isUnmountingRef.current = true;
        cleanupSocket();
      };
    }

    initializeSocket();

    return () => {
      isUnmountingRef.current = true;
      cleanupSocket();
    };
  }, [cleanupSocket, initializeSocket, isUserAuthenticated]);

  const handleRetry = () => {
    retryCountRef.current = 0;
    initializeSocket();
  };

  const sendButtonEvent = (buttonEvent) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ deviceId, buttonEvent });
      socketRef.current.send(message);
      console.log('Sent:', message);
    }
  };

  const handlePress = () => {
    setLocalPressed(true);
    sendButtonEvent('PRESSED');
  };

  const handleRelease = () => {
    setLocalPressed(false);
    sendButtonEvent('RELEASED');
  };

  const displayPressed = isPressed || localPressed;

  if (!isUserAuthenticated) {
    return (
      <div className="websocket-container">
        <div className="websocket-card">
          <p>Please <a href="/login">log in</a> to use the FitzNet Bell.</p>
        </div>
      </div>
    );
  }

  if (connectionState === 'error') {
    return (
      <div className="websocket-container">
        <div className="websocket-card">
          <h2 className="websocket-title">FitzNet Bell Web Edition</h2>
          <div className="connection-error">
            <div className="error-icon">⚠️</div>
            <p className="error-message">Unable to connect to FitzNet Bell. The service may be offline.</p>
            <button className="retry-button" onClick={handleRetry}>Retry Connection</button>
          </div>
        </div>
      </div>
    );
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

        <div className="gamerbell-scene-wrapper">
          <GamerBellWidget
            active={ledOn}
            isPressed={displayPressed}
            screenText={screenText}
            onPress={isConnected ? handlePress : undefined}
            onRelease={isConnected ? handleRelease : undefined}
          />
        </div>

        <p className="instruction-text">
          Click the red button or press &amp; hold below.
        </p>

        <button
          className={`ws-button ${displayPressed ? 'pressed' : ''}`}
          onMouseDown={handlePress}
          onMouseUp={handleRelease}
          onMouseLeave={handleRelease}
          onTouchStart={handlePress}
          onTouchEnd={handleRelease}
          disabled={!isConnected}
        >
          Press Me
        </button>

        <div className="device-info">
          <small>Device ID: <code>{deviceId}</code></small>
        </div>
      </div>
    </div>
  );
}

export default WebSocketButton;


