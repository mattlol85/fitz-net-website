import React, { useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import useAttachmentUrl from '../../hooks/useAttachmentUrl';
import Dialog from './Dialog';
import '../../css/ai/attachments.css';

/**
 * An image attached to a message. The bytes are fetched with the bearer token and shown through
 * an object URL; clicking opens the full image in a dialog.
 */
export default function AttachmentThumb({ attachment }) {
  const { token } = useAuth();
  const { url, error } = useAttachmentUrl(token, attachment.id);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const name = attachment.name || 'image';

  if (error) return <span className="ai-chat__thumb ai-chat__thumb--error">Image unavailable</span>;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="ai-chat__thumb"
        aria-label={`Open image ${name}`}
        disabled={!url}
        onClick={() => setOpen(true)}
      >
        {url ? <img src={url} alt={name} /> : <span className="ai-chat__spinner" aria-hidden="true" />}
      </button>
      {open && url && (
        <Dialog label={name} variant="modal" className="ai-chat__dialog--image" openerRef={buttonRef} onClose={() => setOpen(false)} showClose>
          <img className="ai-chat__lightbox-img" src={url} alt={name} />
        </Dialog>
      )}
    </>
  );
}
