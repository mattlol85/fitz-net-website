import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// `<img>` cannot send the bearer token, so protected images are fetched with it and shown through
// object URLs. One entry per `${cacheKey}:${id}`, shared by every component that shows the same
// image and revoked when the last one unmounts. `cacheKey` keeps features apart ("ai-attachment",
// "recipe-image"), so two features can never hand each other's bytes out for the same id.
const cache = new Map();

/**
 * `{ url, error }` for a protected image. `fetchBlob(token, id)` must be a stable (module-level)
 * function that resolves the image's Blob. With no `id` the hook does nothing.
 */
export default function useAuthedObjectUrl(cacheKey, fetchBlob, id) {
  const { token } = useAuth();
  const [state, setState] = useState({ url: null, error: false });

  useEffect(() => {
    if (!id) {
      setState({ url: null, error: false });
      return undefined;
    }

    const key = `${cacheKey}:${id}`;
    let entry = cache.get(key);
    if (!entry) {
      entry = { refs: 0 };
      entry.promise = fetchBlob(token, id).then((blob) => {
        entry.url = URL.createObjectURL(blob);
        return entry.url;
      });
      entry.promise.catch(() => {
        if (cache.get(key) === entry) cache.delete(key);
      });
      cache.set(key, entry);
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
        if (cache.get(key) === entry) cache.delete(key);
        // Revoke now if the bytes arrived, else as soon as they do.
        if (entry.url) URL.revokeObjectURL(entry.url);
        else entry.promise.then((url) => URL.revokeObjectURL(url)).catch(() => {});
      }
    };
  }, [cacheKey, fetchBlob, token, id]);

  return state;
}
