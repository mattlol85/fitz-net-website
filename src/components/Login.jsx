import React, { useState } from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../css/Login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const successMessage = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      // Redirect to homepage after successful login
      navigate('/');
    } else {
      setError(result.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Login to Fitz-Net</h2>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {successMessage && (
            <div style={{ background: '#efe', border: '1px solid #6c6', color: '#363', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem', textAlign: 'center' }}>
              {successMessage}
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-help">
          <p>
            Don't have an account? <Link to="/register" className="register-link">Sign up</Link>
          </p>
          <p>
            <Link to="/forgot-password" className="register-link">Forgot your password?</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;

