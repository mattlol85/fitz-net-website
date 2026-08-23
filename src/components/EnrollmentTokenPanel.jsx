import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { generateEnrollmentToken } from '../services/nodeService';
import '../css/EnrollmentTokenPanel.css';

export default function EnrollmentTokenPanel() {
  const { token: authToken, isAuthenticated } = useAuth();
  const [label, setLabel] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const authed = isAuthenticated();

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await generateEnrollmentToken(authToken, label.trim() || undefined);
      setResult(res);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.token) return;
    try {
      await navigator.clipboard.writeText(result.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the token is still selectable in the box.
    }
  };

  if (!authed) {
    return (
      <div className="enrollment-token-panel">
        <h2>Enroll a new AI node</h2>
        <p className="enrollment-token-panel__hint">
          <a href="/login">Log in</a> to generate a one-time enrollment token for a new node.
        </p>
      </div>
    );
  }

  return (
    <div className="enrollment-token-panel">
      <h2>Enroll a new AI node</h2>
      <div className="enrollment-token-panel__controls">
        <input
          type="text"
          placeholder="Node label (optional, e.g. brother-pc)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={64}
          aria-label="Node label"
        />
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Enrollment Token'}
        </button>
      </div>

      {error && <div className="enrollment-token-panel__error">{error}</div>}

      {result && (
        <div className="enrollment-token-panel__result">
          <code className="enrollment-token-panel__token">{result.token}</code>
          <button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
          <p className="enrollment-token-panel__expiry">
            Expires at {new Date(result.expiresAt).toLocaleTimeString()} — valid once, for 30 minutes.
          </p>
        </div>
      )}
    </div>
  );
}
