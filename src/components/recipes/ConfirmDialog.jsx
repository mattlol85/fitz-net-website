import React, { useEffect, useId, useRef } from 'react';
import '../../css/recipes/ConfirmDialog.css';

/**
 * A small modal that asks before something is deleted. Focus lands on Cancel, Tab stays inside the
 * dialog, Escape and a click on the backdrop cancel, and focus returns to what opened it.
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', busy = false, error = '', onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="confirm-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="confirm-dialog__title">
          {title}
        </h2>
        <p id={messageId} className="confirm-dialog__message">
          {message}
        </p>
        {error && (
          <p className="confirm-dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-dialog__actions">
          <button ref={cancelRef} type="button" className="rb-button" onClick={onCancel} disabled={busy}>
            Keep it
          </button>
          <button type="button" className="rb-button rb-button--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
