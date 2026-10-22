import React, { useState } from 'react';

/**
 * Destructive button with an in-page confirm step (no window.confirm):
 * the first click swaps the button for "Confirm" / "Cancel".
 */
function ConfirmAction({ label, confirmLabel = 'Confirm', onConfirm, children }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" className="joenet-button joenet-button--danger" onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="joenet-confirm" role="group" aria-label={`Confirm ${label}`}>
      {children}
      <button
        type="button"
        className="joenet-button joenet-button--danger"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="joenet-button" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  );
}

export default ConfirmAction;
