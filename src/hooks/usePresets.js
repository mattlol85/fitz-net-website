import { useCallback, useEffect, useRef, useState } from 'react';
import { createPreset, deletePreset, listPresets, updatePreset } from '../services/aiChatApi';

/**
 * The presets the caller can see (GET /ai/presets), plus create / update / delete. The mutators
 * reject with the API's ApiError so a form can show the server's 400/403 message inline.
 */
export default function usePresets({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const { items: list } = await listPresets(token);
      if (request !== requestRef.current) return;
      setItems(list || []);
      setError(null);
    } catch (err) {
      if (request === requestRef.current) setError(err.message || 'Could not load presets');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
    return () => {
      requestRef.current += 1;
    };
  }, [reload]);

  const save = useCallback(
    async (preset, id) => {
      const saved = id ? await updatePreset(token, id, preset) : await createPreset(token, preset);
      await reload();
      return saved;
    },
    [token, reload]
  );

  const remove = useCallback(
    async (id) => {
      await deletePreset(token, id);
      await reload();
    },
    [token, reload]
  );

  return { items, loading, error, reload, save, remove };
}
