import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createConversation,
  generateTitle,
  getContextUsage,
  getConversation,
  editMessage,
  getPreferences,
  regenerateMessage,
  sendMessage,
  summarizeConversation,
  updateConversation,
  updatePreferences,
  warmUp,
} from '../services/aiChatApi';
import { isAbortError } from '../services/sse';
import { resolveDefaultTarget, sameTarget, toContextInfo } from '../components/ai/aiChatUtils';
import { applyTurnEvent } from '../components/ai/turnEvents';

export const WARM_UP_DEBOUNCE_MS = 400;

// Optimistic rows have a local key until the API tells us the real id.
const isLocalId = (id) => String(id).startsWith('local-');

const requestFrame = (fn) =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16);
const cancelFrame = (handle) =>
  typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(handle) : clearTimeout(handle);
const EMPTY_SETTINGS = { presetId: null, systemPrompt: null };

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
  // What the next turn will do with the window: { model, contextLength, usedTokens, trimmedCount, summaryActive }.
  const [contextInfo, setContextInfo] = useState(null);
  const [dismissedTrim, setDismissedTrim] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  // Preset and system prompt for a chat that has no conversation yet; passed to createConversation.
  const [draftSettings, setDraftSettings] = useState(EMPTY_SETTINGS);

  // The conversation id whose data `conversation` / `messages` hold ('' = none yet).
  const loadedIdRef = useRef(null);
  // Bumped by every send and every conversation switch; stale stream handlers compare against it.
  const turnRef = useRef(0);
  const abortRef = useRef(null);
  const messagesRef = useRef([]);
  const warmTimerRef = useRef(null);
  const flushRef = useRef(null);
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
    setContextInfo(null);
    setDismissedTrim(null);
    setSummarizing(false);
    setDraftSettings(EMPTY_SETTINGS);

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
        setContextInfo(toContextInfo(detail.context));
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
      flushRef.current?.();
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

  /** Quietly reloads the open conversation from the server (no loading state) and replaces the list. */
  const refetch = useCallback(
    async (id) => {
      if (!id) return null;
      try {
        const detail = await getConversation(token, id);
        if (loadedIdRef.current !== id || abortRef.current) return null;
        const { messages: stored, ...rest } = detail;
        setConversation(rest);
        setMessages(stored);
        setUsage(usageFromDetail(detail));
        return detail;
      } catch {
        return null;
      }
    },
    [token]
  );

  const mergeConversation = useCallback((updated) => {
    setConversation((c) => (c && c.id === updated.id ? { ...c, ...updated } : c));
  }, []);

  const scheduleWarm = useCallback(
    (next) => {
      clearTimeout(warmTimerRef.current);
      warmTimerRef.current = setTimeout(() => {
        warmUp(token, next)
          .then((result) => latest.current.onWarmUp?.(result))
          .catch(() => {});
      }, WARM_UP_DEBOUNCE_MS);
    },
    [token]
  );

  /** Re-checks the window for `next` (only worth it once there is history). */
  const preflight = useCallback(
    (id, next) => {
      if (messagesRef.current.length === 0) return;
      getContextUsage(token, id, { model: next.model, nodeId: next.nodeId })
        .then((context) => {
          if (loadedIdRef.current !== id) return;
          setUsage({ used: context.usedTokens || 0, max: context.contextLength || 0 });
          setContextInfo(toContextInfo(context));
          setConversation((c) => (c ? { ...c, context } : c));
        })
        // 503: the new target cannot be resolved right now, so there is nothing to warn about.
        .catch(() => {
          if (loadedIdRef.current === id) setContextInfo(null);
        });
    },
    [token]
  );

  /** Picker selection: warm the model up (debounced), then remember it. */
  const selectTarget = useCallback(
    (next) => {
      setOverride(next);
      scheduleWarm(next);

      const id = loadedIdRef.current;
      if (!id) {
        updatePreferences(token, { lastTarget: next })
          .then(setPreferences)
          .catch(() => {});
        return;
      }

      setPreferences((p) => (p ? { ...p, lastTarget: next } : p));
      preflight(id, next);
      updateConversation(token, id, { target: next })
        .then((updated) => {
          if (loadedIdRef.current === id) mergeConversation(updated);
        })
        .catch((err) => {
          if (loadedIdRef.current === id) setNotice(err.message || 'Could not save the model choice.');
        });
    },
    [token, mergeConversation, scheduleWarm, preflight]
  );

  const settings = useMemo(
    () =>
      conversation
        ? {
            presetId: conversation.settings?.presetId ?? null,
            systemPrompt: conversation.settings?.systemPrompt ?? null,
          }
        : draftSettings,
    [conversation, draftSettings]
  );

  /**
   * Stores `{ presetId, systemPrompt }`. On an existing conversation it is PATCHed whole, without
   * a target: when the preset pins a model the server copies it into the target and we follow the
   * response. With no conversation yet it is held locally for createConversation, and a pinned
   * model becomes the selection straight away (Auto when the preset has no node).
   */
  const updateSettings = useCallback(
    async (next, preset = null) => {
      const id = loadedIdRef.current;
      if (!id) {
        setDraftSettings(next);
        if (preset?.model) selectTarget({ model: preset.model, nodeId: preset.nodeId ?? null });
        return;
      }
      try {
        const updated = await updateConversation(token, id, { settings: next });
        if (loadedIdRef.current !== id) return;
        mergeConversation(updated);
        if (updated.target) {
          const changed = !sameTarget(updated.target, override ?? conversation?.target);
          setOverride(updated.target);
          if (changed) {
            scheduleWarm(updated.target);
            preflight(id, updated.target);
            setPreferences((p) => (p ? { ...p, lastTarget: updated.target } : p));
          }
        }
      } catch (err) {
        if (loadedIdRef.current === id) setNotice(err.message || 'Could not save the chat settings.');
      }
    },
    [token, selectTarget, mergeConversation, scheduleWarm, preflight, override, conversation]
  );

  /** New chat from a blank chat: the URL does not change, so drop the unsent settings by hand. */
  const resetDraft = useCallback(() => {
    if (loadedIdRef.current) return;
    setDraftSettings(EMPTY_SETTINGS);
    setOverride(null);
  }, []);

  const applyPreset = useCallback(
    (preset) => updateSettings({ presetId: preset?.id ?? null, systemPrompt: settings.systemPrompt }, preset),
    [updateSettings, settings.systemPrompt]
  );

  const saveSystemPrompt = useCallback(
    (text) => updateSettings({ presetId: settings.presetId, systemPrompt: text ? text : null }),
    [updateSettings, settings.presetId]
  );

  /**
   * Runs one streamed turn (send, regenerate or edit). `prepare(messages, assistantKey)` returns
   * the optimistic list (ending with the streaming assistant placeholder); `call(id, options)`
   * starts the request. Resolves `{ restoreDraft: true }` when the request was rejected before
   * anything was stored, so a composer or editor can put the text back.
   */
  const runTurn = useCallback(
    async ({ turnTarget, prepare, call, userKey = null, onDone, createIfNeeded = false }) => {
      const turn = ++turnRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      const isCurrent = () => turnRef.current === turn;
      const snapshot = messagesRef.current;
      const assistantKey = `local-assistant-${turn}`;
      let received = false;
      // True once the API has told us the real ids (meta, or an early done/error).
      let serverIds = false;

      setNotice(null);
      setStreaming(true);
      setMessages(prepare(snapshot, assistantKey));

      const patchAssistant = (fn) =>
        setMessages((prev) => prev.map((m) => (m.clientKey === assistantKey ? fn(m) : m)));

      // thinking/token deltas arrive many times a frame; re-rendering (and re-highlighting) the
      // whole message for each is wasteful, so they are buffered and applied once per frame.
      const pending = { thinking: '', token: '', frame: null };
      const flush = () => {
        if (pending.frame !== null) {
          cancelFrame(pending.frame);
          pending.frame = null;
        }
        const { thinking, token: text } = pending;
        pending.thinking = '';
        pending.token = '';
        if (!thinking && !text) return;
        patchAssistant((m) => {
          let next = m;
          if (thinking) next = applyTurnEvent(next, 'thinking', { content: thinking });
          if (text) next = applyTurnEvent(next, 'token', { content: text });
          return next;
        });
      };
      flushRef.current = flush;

      const onEvent = (name, data) => {
        if (!isCurrent()) return;
        received = true;
        if (name === 'thinking' || name === 'token') {
          pending[name === 'token' ? 'token' : 'thinking'] += data.content || '';
          if (pending.frame === null) pending.frame = requestFrame(flush);
          return;
        }
        flush();
        // meta, done and error all name the user message; take its real id from whichever comes first.
        if (userKey && data.userMessageId) {
          serverIds = true;
          setMessages((prev) =>
            prev.map((m) => (m.clientKey === userKey ? { ...m, id: data.userMessageId } : m))
          );
        }
        if (name === 'meta' || data.messageId) serverIds = true;
        if (name === 'meta') {
          setMessages((prev) =>
            prev.map((m) => (m.clientKey === assistantKey ? applyTurnEvent(m, name, data) : m))
          );
          setUsage((u) => ({
            used: data.context?.promptTokensEstimate ?? u.used,
            max: data.contextLength || u.max,
          }));
          setContextInfo(
            toContextInfo(data.context, { model: data.model, contextLength: data.contextLength })
          );
          // The header follows what actually ran (Auto stays Auto).
          setOverride({ model: data.model, nodeId: data.auto ? null : data.nodeId });
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

      const reconcile = () => {
        // The API finalises a cancelled or dropped reply a moment after the disconnect.
        const attempt = (delay, last) => {
          setTimeout(async () => {
            if (!isCurrent() || abortRef.current) return;
            const detail = await refetch(id);
            const stillOpen = detail?.messages.some((m) => m.status === 'streaming');
            if (stillOpen && !last) attempt(1500, true);
          }, delay);
        };
        if (id) attempt(400, false);
      };

      let id = loadedIdRef.current;
      try {
        if (!id && createIfNeeded) {
          const hasSettings = draftSettings.presetId || draftSettings.systemPrompt;
          const created = await createConversation(
            token,
            { target: turnTarget, ...(hasSettings && { settings: draftSettings }) },
            { signal: controller.signal }
          );
          if (!isCurrent()) return { restoreDraft: false };
          id = created.id;
          loadedIdRef.current = id;
          setConversation(created);
          latest.current.onListChange?.();
          latest.current.setConversationId?.(id, { replace: true });
        }

        const result = await call(id, { signal: controller.signal, onEvent });
        flush();
        if (!isCurrent()) return { restoreDraft: false };
        onDone?.(result, id);
        return { restoreDraft: false };
      } catch (err) {
        if (!isCurrent()) return { restoreDraft: false };
        flush();
        if (isAbortError(err) && !id) {
          // Stopped while the conversation was still being created: nothing exists anywhere.
          setMessages(snapshot);
          return { restoreDraft: true };
        }
        if (isAbortError(err)) {
          if (!serverIds) reconcile();
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
          if (!serverIds) reconcile();
          patchAssistant((m) => ({
            ...m,
            status: 'error',
            live: null,
            error: { code: err.code || 'CONNECTION_LOST', message: err.message },
          }));
          return { restoreDraft: false };
        }
        // Rejected up front (400/404/409, network): nothing changed on the server, so undo.
        setMessages(snapshot);
        setNotice(err.message || 'The request could not be sent.');
        return { restoreDraft: true };
      } finally {
        flush();
        if (isCurrent()) {
          abortRef.current = null;
          setStreaming(false);
          latest.current.onListChange?.();
        }
      }
    },
    [token, draftSettings, refetch]
  );

  const placeholder = (assistantKey) => ({
    id: assistantKey,
    clientKey: assistantKey,
    role: 'assistant',
    content: '',
    thinking: null,
    status: 'streaming',
    generation: null,
    live: null,
    createdAt: new Date().toISOString(),
  });

  /**
   * Sends `content` (and uploaded `attachments`, which may stand in for the text) on the current
   * target and streams the reply into the message list.
   */
  const send = useCallback(
    (content, attachments = []) => {
      const text = content.trim();
      if ((!text && attachments.length === 0) || abortRef.current || !target) {
        return Promise.resolve({ restoreDraft: false });
      }

      const firstReply = !messagesRef.current.some((m) => m.role === 'assistant' && m.status === 'complete');
      const userKey = `local-user-${turnRef.current + 1}`;
      const body = {
        content: text,
        ...(attachments.length > 0 && { attachmentIds: attachments.map((a) => a.id) }),
        target,
      };
      return runTurn({
        turnTarget: target,
        userKey,
        createIfNeeded: true,
        prepare: (prev, assistantKey) => [
          ...prev,
          {
            id: userKey, clientKey: userKey, role: 'user', content: text, attachments,
            status: 'complete', createdAt: new Date().toISOString(),
          },
          placeholder(assistantKey),
        ],
        call: (id, options) => sendMessage(token, id, body, options),
        onDone: (result, id) => {
          if (result.event === 'done' && firstReply) {
            generateTitle(token, id)
              .then((updated) => {
                if (loadedIdRef.current === id) mergeConversation(updated);
                latest.current.onListChange?.();
              })
              .catch(() => {});
          }
        },
      });
    },
    [token, target, runTurn, mergeConversation]
  );

  /**
   * Regenerates an assistant message: it and everything after it are removed, then a new answer
   * is generated. `newTarget` (a failover or "Regenerate with...") becomes the current selection.
   */
  const regenerate = useCallback(
    (messageId, newTarget) => {
      const turnTarget = newTarget || target;
      if (abortRef.current || !turnTarget || !loadedIdRef.current) return Promise.resolve({ restoreDraft: false });
      if (!messagesRef.current.some((m) => m.id === messageId && !isLocalId(m.id))) {
        // The list is out of step with the server: reload instead of sending a doomed request.
        refetch(loadedIdRef.current);
        return Promise.resolve({ restoreDraft: false });
      }
      return runTurn({
        turnTarget,
        prepare: (prev, assistantKey) => {
          const index = prev.findIndex((m) => m.id === messageId);
          if (index === -1) return prev;
          return [...prev.slice(0, index), placeholder(assistantKey)];
        },
        call: (id, options) => regenerateMessage(token, id, messageId, { target: turnTarget }, options),
      });
    },
    [token, target, runTurn, refetch]
  );

  /** Edits a user message in place and answers it again; later messages are removed. */
  const edit = useCallback(
    (messageId, content) => {
      const text = content.trim();
      const original = messagesRef.current.find((m) => m.id === messageId && !isLocalId(m.id));
      if (!original) {
        if (loadedIdRef.current && !abortRef.current) refetch(loadedIdRef.current);
        return Promise.resolve({ restoreDraft: false });
      }
      // An image-only message may be edited down to no text; a text-only one may not.
      const hasImages = (original.attachments?.length || 0) > 0;
      if ((!text && !hasImages) || abortRef.current || !target || !loadedIdRef.current) {
        return Promise.resolve({ restoreDraft: false });
      }
      return runTurn({
        turnTarget: target,
        prepare: (prev, assistantKey) => {
          const index = prev.findIndex((m) => m.id === messageId);
          if (index === -1) return prev;
          return [
            ...prev.slice(0, index),
            { ...prev[index], content: text, editedAt: new Date().toISOString() },
            placeholder(assistantKey),
          ];
        },
        call: (id, options) => editMessage(token, id, messageId, { content: text, target }, options),
      });
    },
    [token, target, runTurn, refetch]
  );

  /** "Summarise older turns": folds the messages that no longer fit into a stored summary. */
  const summarize = useCallback(async () => {
    const id = loadedIdRef.current;
    if (!id || summarizing) return;
    setSummarizing(true);
    try {
      const result = await summarizeConversation(token, id);
      if (loadedIdRef.current !== id) return;
      setConversation((c) =>
        c ? { ...c, ...result.conversation, summary: result.summary, context: result.context } : c
      );
      if (result.context) {
        setUsage({ used: result.context.usedTokens || 0, max: result.context.contextLength || 0 });
        setContextInfo(toContextInfo(result.context));
      }
      latest.current.onListChange?.();
    } catch (err) {
      if (loadedIdRef.current === id) setNotice(err.message || 'Could not summarise the conversation.');
    } finally {
      setSummarizing(false);
    }
  }, [token, summarizing]);

  const trimKey = contextInfo ? `${conversation?.id}:${contextInfo.model}:${contextInfo.trimmedCount}` : null;
  const dismissTrim = useCallback(() => setDismissedTrim(trimKey), [trimKey]);
  const trimWarning =
    contextInfo && contextInfo.trimmedCount > 0 && dismissedTrim !== trimKey
      ? { count: contextInfo.trimmedCount, model: contextInfo.model || target?.model }
      : null;

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
    regenerate,
    edit,
    summarize,
    summarizing,
    trimWarning,
    summaryPartial: Boolean(conversation?.summary?.partial),
    settings,
    applyPreset,
    saveSystemPrompt,
    resetDraft,
    summaryActive: Boolean(contextInfo?.summaryActive) && !(contextInfo?.trimmedCount > 0),
    dismissTrim,
    stop,
    selectTarget,
    retryLoad,
    mergeConversation,
    dismissNotice,
  };
}
