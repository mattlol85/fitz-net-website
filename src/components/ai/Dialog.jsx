import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab and Shift+Tab inside `container` (call from its keydown handler). */
export function trapTab(event, container) {
  if (event.key !== 'Tab' || !container) return;
  const items = [...container.querySelectorAll(FOCUSABLE)];
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * An accessible dialog: focus moves in on open, Tab stays inside, Esc closes (without also
 * closing a dialog underneath) and focus goes back to whatever opened it.
 *
 * `variant="modal"` is a centred sheet over a backdrop (portalled into the chat root so the
 * theme variables apply); `variant="popover"` is positioned by its CSS class and closes on an
 * outside click.
 */
export default function Dialog({
  label,
  onClose,
  variant = 'modal',
  className = '',
  initialFocus,
  openerRef,
  showClose = false,
  children,
}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const skipRestore = useRef(false);

  useEffect(() => {
    const opener = openerRef?.current || document.activeElement;
    const container = ref.current;
    const target =
      (initialFocus && container?.querySelector(initialFocus)) || container?.querySelector(FOCUSABLE) || container;
    target?.focus?.();
    return () => {
      if (!skipRestore.current && opener && document.contains(opener)) opener.focus?.();
    };
  }, [initialFocus, openerRef]);

  useEffect(() => {
    if (variant !== 'popover') return undefined;
    const onMouseDown = (e) => {
      const container = ref.current;
      if (!container || container.contains(e.target)) return;
      if (openerRef?.current?.contains(e.target)) return;
      // A modal opened from inside the popover is "inside" it.
      if (e.target.closest?.('[aria-modal="true"]')) return;
      skipRestore.current = true;
      closeRef.current?.();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [variant, openerRef]);

  const onKeyDown = (e) => {
    // Events bubbling up from a dialog portalled out of this one belong to that dialog.
    if (!ref.current?.contains(e.target)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeRef.current?.();
      return;
    }
    trapTab(e, ref.current);
  };

  const panel = (
    <div
      ref={ref}
      role="dialog"
      aria-modal={variant === 'modal' ? 'true' : undefined}
      aria-label={label}
      tabIndex={-1}
      className={`ai-chat__dialog ai-chat__dialog--${variant}${className ? ` ${className}` : ''}`}
      onKeyDown={onKeyDown}
    >
      {showClose && (
        <button type="button" className="ai-chat__icon-button ai-chat__dialog-close" aria-label="Close" onClick={() => onClose?.()}>
          <CloseIcon size={18} />
        </button>
      )}
      {children}
    </div>
  );

  if (variant !== 'modal') return panel;
  const host = document.querySelector('.ai-chat') || document.body;
  return createPortal(
    <div
      className="ai-chat__overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current?.();
      }}
    >
      {panel}
    </div>,
    host
  );
}
