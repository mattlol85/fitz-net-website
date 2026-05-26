import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_BOARD_COLOR } from '../constants';
import '../css/EditProfile.css';

function EditProfile() {
  const { user, loading: authLoading, isAuthenticated, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !email) {
      setError('Username and email are required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password || confirmPassword) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setSaving(true);
    const result = await updateProfile({
      username,
      email,
      password: password || undefined,
    });
    setSaving(false);

    if (!result.success) {
      setError(result.message || 'Failed to update profile');
      return;
    }

    setSuccess('Profile updated successfully.');
    setPassword('');
    setConfirmPassword('');
  };

  if (authLoading) {
    return (
      <div className="edit-profile-container">
        <div className="edit-profile-card">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="edit-profile-container">
      <div className="edit-profile-card">
        <h2 className="edit-profile-title">Edit Profile</h2>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={saving}
            />
          </div>

          <div className="form-group">
            <label>Board Color</label>
            <div className="board-color-display" data-testid="board-color-display">
              <span
                className="board-color-swatch"
                style={{ background: user?.boardColor || DEFAULT_BOARD_COLOR }}
                data-testid="board-color-swatch"
              />
              <span className="board-color-label">
                {user?.boardColor || DEFAULT_BOARD_COLOR}
              </span>
              <span className="board-color-hint">(auto-assigned, permanent)</span>
            </div>
          </div>

          <div className="form-divider">Change Password (Optional)</div>

          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              disabled={saving}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              disabled={saving}
              autoComplete="new-password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="edit-profile-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate('/')}
              disabled={saving}
            >
              Back
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfile;
