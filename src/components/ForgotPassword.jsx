import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import '../css/Login.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const result = await forgotPassword(email);
    setLoading(false);
    setStatus({ success: result.success, message: result.message });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Forgot Password</h2>

        {status?.success ? (
          <div>
            <p style={{ color: 'var(--text-primary)', textAlign: 'center', marginBottom: '1.5rem' }}>
              {status.message}
            </p>
            <div className="login-help">
              <p>
                <Link to="/login" className="register-link">Back to Login</Link>
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <p style={{ color: 'var(--text-secondary, #666)', fontSize: '0.95rem', margin: 0 }}>
              Enter your account email and we'll send you a reset link.
            </p>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>

            {status && !status.success && (
              <div className="error-message">{status.message}</div>
            )}

            <button type="submit" className="login-button" disabled={loading || !email}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="login-help">
              <p>
                Remember your password? <Link to="/login" className="register-link">Login</Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
