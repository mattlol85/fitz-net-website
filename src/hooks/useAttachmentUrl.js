import { useEffect, useState } from 'react';
import { fetchAttachment } from '../services/aiChatApi';

// `<img>` cannot send the bearer token, so attachments are fetched and shown through object
// URLs. One entry per attachment id, shared by every message that shows it and revoked when the
// last one unmounts.
const cache = new Map();

/** `{ url, error }` for an attachment's bytes. */
export default function useAttachmentUrl(token, id) {
  const [state, setState] = useState({ url: null, error: false });

  useEffect(() => {
    if (!id) return undefined;

    let entry = cache.get(id);
    if (!entry) {
      entry = { refs: 0 };
      entry.promise = fetchAttachment(token, id).then((blob) => {
        entry.url = URL.createObjectURL(blob);
        return entry.url;
      });
      entry.promise.catch(() => {
        if (cache.get(id) === entry) cache.delete(id);
      });
      cache.set(id, entry);
    }
    entry.refs += 1;
    let active = true;
    entry.promise.then(
      (url) => active && setState({ url, error: false }),
      () => active && setState({ url: null, error: true })
    );

    return () => {
      active = false;
      entry.refs -= 1;
      if (entry.refs === 0) {
        if (cache.get(id) === entry) cache.delete(id);
        // Revoke now if the bytes arrived, else as soon as they do.
        if (entry.url) URL.revokeObjectURL(entry.url);
        else entry.promise.then((url) => URL.revokeObjectURL(url)).catch(() => {});
      }
    };
  }, [token, id]);

  return state;
}
