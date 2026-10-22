import React from 'react';

/** Shared loading / error wrapper for a section's data; renders children once loaded. */
function JoenetState({ loading, error, onRetry, children }) {
  if (error) {
    return (
      <div role="alert" className="joenet-message error">
        {error}
        {onRetry && (
          <button type="button" className="joenet-button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }
  if (loading) return <p className="joenet-muted">Loading…</p>;
  return children;
}

export default JoenetState;
