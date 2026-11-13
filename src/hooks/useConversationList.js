import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteConversation,
  listConversations,
  updateConversation,
} from '../services/aiChatApi';

export const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 50;

/**
 * The sidebar's conversations: pinned first, optionally filtered by a debounced search term
 * (sent to the list endpoint as `q`). Row actions call the API and patch the list in place.
 */
export default function useConversationList({ token }) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);
  const termRef = useRef('');

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(
    async ({ offset = 0 } = {}) => {
      const request = ++requestRef.current;
      try {
        const page = await listConversations(token, { q: termRef.current, limit: PAGE_SIZE, offset });
        if (request !== requestRef.current) return;
        setItems((prev) => (offset ? [...prev, ...page.items] : page.items));
        setHasMore(Boolean(page.hasMore));
        setError(null);
      } catch (err) {
        if (request === requestRef.current) setError(err.message || 'Could not load conversations');
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    termRef.current = term;
    fetchPage();
  }, [term, fetchPage]);

  const reload = useCallback(() => fetchPage(), [fetchPage]);
  const loadMore = useCallback(() => fetchPage({ offset: items.length }), [fetchPage, items.length]);

  const replace = useCallback((conversation) => {
    setItems((prev) => prev.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c)));
  }, []);

  const rename = useCallback(
    async (id, title) => {
      const updated = await updateConversation(token, id, { title });
      replace(updated);
      return updated;
    },
    [token, replace]
  );

  const setPinned = useCallback(
    async (id, pinned) => {
      const updated = await updateConversation(token, id, { pinned });
      replace(updated);
      // Pinning moves the row between sections, so take the server's order.
      await fetchPage();
      return updated;
    },
    [token, replace, fetchPage]
  );

  const remove = useCallback(
    async (id) => {
      await deleteConversation(token, id);
      setItems((prev) => prev.filter((c) => c.id !== id));
    },
    [token]
  );

  return {
    items, hasMore, loading, error, search, setSearch, reload, loadMore, rename, setPinned, remove, replace,
  };
}
