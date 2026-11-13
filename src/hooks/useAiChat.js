import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createConversation,
  generateTitle,
  getContextUsage,
  getConversation,
  getPreferences,
  sendMessage,
  updateConversation,
  updatePreferences,
  warmUp,
} from '../services/aiChatApi';
import { isAbortError } from '../services/sse';
import { resolveDefaultTarget } from '../components/ai/aiChatUtils';
import { applyTurnEvent } from '../components/ai/turnEvents';

export const WARM_UP_DEBOUNCE_MS = 400;

/** The ring shows the last reply's footprint; before any reply, the server's estimate. */
function usageFromDetail(detail) {
  if (detail.context?.contextLength) {
    return { used: detail.context.usedTokens || 0, max: detail.context.contextLength };
  }
  const last = [...detail.messages].reverse().find((m) => m.generation?.promptTokens != null);
  if (last) {
    return {
      used: (last.generation.promptTokens || 0) + (last.generation.completionTokens || 0),
      max: last.generation.contextLength || 0,
    };
  }
  return { used: 0, max: 0 };
}

/**
 * Owns the open conversation: loading it from the server, the target (model + node) it runs on,
 * and the live turn stream.
 *
 * `conversationId` comes from the URL (`/ai?c=<id>`); a new chat has none and the conversation is
 * created lazily on the first send, after which `setConversationId(id, { replace: true })` puts
 * it in the URL. The browser never sends history: the server rebuilds the prompt from storage.
 */
export default function useAiChat({
  token,
  conversationId,
  catalogue,
  setConversationId,
  onListChange,
  onWarmUp,
}) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState(null);
  const [override, setOverride] = useState(null);
  const [usage, setUsage] = useState({ used: 0, max: 0 });
  const [preferences, setPreferences] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // The conversation id whose data `conversation` / `messages` hold ('' = none yet).
  const loadedIdRef = useRef(null);
  // Bumped by every send and every conversation switch; stale stream handlers compare against it.
  const turnRef = useRef(0);
  const abortRef = useRef(null);
  const messagesRef = useRef([]);
  const warmTimerRef = useRef(null);
  const latest = useRef({});
  messagesRef.current = messages;
  latest.current = { onListChange, onWarmUp, setConversationId };

  useEffect(() => {
    let cancelled = false;
    getPreferences(token)
      .then((p) => !cancelled && setPreferences(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Load (or reset to) whatever conversation the URL names.
  useEffect(() => {
    const wanted = conversationId || null;
    if (wanted === loadedIdRef.current) return undefined;

    turnRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    loadedIdRef.current = null;
    setStreaming(false);
    setOverride(null);
    setNotice(null);
    setLoadError(null);

    if (!wanted) {
      setConversation(null);
      setMessages([]);
      setUsage({ used: 0, max: 0 });
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setConversation(null);
    setMessages([]);
    setUsage({ used: 0, max: 0 });
    getConversation(token, wanted, { signal: controller.signal })
      .then((detail) => {
        loadedIdRef.current = wanted;
        const { messages: stored, ...rest } = detail;
        setConversation(rest);
        setMessages(stored);
        setUsage(usageFromDetail(detail));
        setLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setLoadError(err.status === 404 ? 'That conversation no longer exists.' : err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [conversationId, token, reloadKey]);

  useEffect(
    () => () => {
      turnRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      clearTimeout(warmTimerRef.current);
    },
    []
  );

  const defaultTarget = useMemo(
    () => resolveDefaultTarget(preferences?.lastTarget, catalogue),
    [preferences, catalogue]
  );
  const target = override ?? conversation?.target ?? defaultTarget;

  const retryLoad = useCallback(() => {
    loadedIdRef.current = null;
    setReloadKey((k) => k + 1);
  }, []);

  const mergeConversation = useCallback((updated) => {
    setConversation((c) => (c && c.id === updated.id ? { ...c, ...updated } : c));
  }, []);

  /** Picker selection: warm the model up (debounced), then remember it. */
  const selectTarget = useCallback(
    (next) => {
      setOverride(next);

      clearTimeout(warmTimerRef.current);
      warmTimerRef.current = setTimeout(() => {
        warmUp(token, next)
          .then((result) => latest.current.onWarmUp?.(result))
          .catch(() => {});
      }, WARM_UP_DEBOUNCE_MS);

      const id = loadedIdRef.current;
      if (!id) {
        updatePreferences(token, { lastTarget: next })
          .then(setPreferences)
          .catch(() => {});
        return;
      }

      setPreferences((p) => (p ? { ...p, lastTarget: next } : p));
      if (messagesRef.current.length > 0) {
        getContextUsage(token, id, { model: next.model, nodeId: next.nodeId })
          .then((context) => {
            if (loadedIdRef.current !== id) return;
            setUsage({ used: context.usedTokens || 0, max: context.contextLength || 0 });
            setConversation((c) => (c ? { ...c, context } : c));
          })
          .catch(() => {});
      }
      updateConversation(token, id, { target: next })
        .then((updated) => {
          if (loadedIdRef.current === id) mergeConversation(updated);
        })
        .catch((err) => {
          if (loadedIdRef.current === id) setNotice(err.message || 'Could not save the model choice.');
        });
    },
    [token, mergeConversation]
  );

  /**
   * Sends `content` on the current target and streams the reply into the message list.
   * Resolves `{ restoreDraft: true }` when the request was rejected before anything was stored,
   * so the composer can put the text back.
   */
  const send = useCallback(
    async (content) => {
      const text = content.trim();
      if (!text || abortRef.current || !target) return { restoreDraft: false };

      const turn = ++turnRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      const isCurrent = () => turnRef.current === turn;
      const firstReply = !messagesRef.current.some((m) => m.role === 'assistant' && m.status === 'complete');
      const userKey = `local-user-${turn}`;
      const assistantKey = `local-assistant-${turn}`;
      let received = false;

      setNotice(null);
      setStreaming(true);
      setMessages((prev) => [
        ...prev,
        {
          id: userKey, clientKey: userKey, role: 'user', content: text, attachments: [],
          status: 'complete', createdAt: new Date().toISOString(),
        },
        {
          id: assistantKey, clientKey: assistantKey, role: 'assistant', content: '', thinking: null,
          status: 'streaming', generation: null, live: null, createdAt: new Date().toISOString(),
        },
      ]);

      const patchAssistant = (fn) =>
        setMessages((prev) => prev.map((m) => (m.clientKey === assistantKey ? fn(m) : m)));

      const onEvent = (name, data) => {
        if (!isCurrent()) return;
        received = true;
        if (name === 'meta') {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.clientKey === userKey) return { ...m, id: data.userMessageId ?? m.id };
              if (m.clientKey === assistantKey) return applyTurnEvent(m, name, data);
              return m;
            })
          );
          if (data.contextLength) setUsage((u) => ({ ...u, max: data.contextLength }));
          return;
        }
        patchAssistant((m) => applyTurnEvent(m, name, data));
        if (name === 'done') {
          setUsage({
            used: (data.promptTokens || 0) + (data.completionTokens || 0),
            max: data.contextLength || 0,
          });
        }
      };

      let id = loadedIdRef.current;
      try {
        if (!id) {
          const created = await createConversation(token, { target }, { signal: controller.signal });
          if (!isCurrent()) return { restoreDraft: false };
          id = created.id;
          loadedIdRef.current = id;
          setConversation(created);
          latest.current.onListChange?.();
          latest.current.setConversationId?.(id, { replace: true });
        }

        const result = await sendMessage(token, id, { content: text, target }, {
          signal: controller.signal,
          onEvent,
        });
        if (!isCurrent()) return { restoreDraft: false };

        if (result.event === 'done' && firstReply) {
          generateTitle(token, id)
            .then((updated) => {
              if (loadedIdRef.current === id) mergeConversation(updated);
              latest.current.onListChange?.();
            })
            .catch(() => {});
        }
        return { restoreDraft: false };
      } catch (err) {
        if (!isCurrent()) return { restoreDraft: false };
        if (isAbortError(err)) {
          patchAssistant((m) => ({
            ...m,
            status: 'cancelled',
            live: null,
            generation: m.generation ? { ...m.generation, finishReason: 'cancelled' } : m.generation,
          }));
          return { restoreDraft: false };
        }
        if (received) {
          // The connection broke mid-reply: keep what arrived and say so.
          patchAssistant((m) => ({
            ...m,
            status: 'error',
            live: null,
            error: { code: err.code || 'CONNECTION_LOST', message: err.message },
          }));
          return { restoreDraft: false };
        }
        // Rejected up front (400/404/409, network): nothing was stored, so undo the optimistic rows.
        setMessages((prev) => prev.filter((m) => m.clientKey !== userKey && m.clientKey !== assistantKey));
        setNotice(err.message || 'The message could not be sent.');
        return { restoreDraft: true };
      } finally {
        if (isCurrent()) {
          abortRef.current = null;
          setStreaming(false);
          latest.current.onListChange?.();
        }
      }
    },
    [token, target, mergeConversation]
  );

  /** Stop: abort the fetch; the API cancels the generation on the node and keeps the partial reply. */
  const stop = useCallback(() => abortRef.current?.abort(), []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    conversation,
    messages,
    loading,
    loadError,
    streaming,
    notice,
    usage,
    target,
    send,
    stop,
    selectTarget,
    retryLoad,
    mergeConversation,
    dismissNotice,
  };
}
