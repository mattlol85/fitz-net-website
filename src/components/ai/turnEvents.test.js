import { describe, expect, it } from 'vitest';
import { applyTurnEvent } from './turnEvents';

const pending = { id: 'tmp', role: 'assistant', content: '', thinking: null, status: 'streaming', generation: null, live: null };

const META = {
  assistantMessageId: 'a1', nodeId: 'n1', nodeName: 'Matt-PC', model: 'llama3.1:8b', auto: true,
  presetId: null, contextLength: 8192, context: { trimmedCount: 0 },
};

describe('applyTurnEvent', () => {
  it('should adopt the real id and the routing details from meta', () => {
    const next = applyTurnEvent(pending, 'meta', META);

    expect(next.id).toBe('a1');
    expect(next.generation).toMatchObject({ nodeName: 'Matt-PC', model: 'llama3.1:8b', auto: true, contextLength: 8192 });
    expect(next.context).toEqual({ trimmedCount: 0 });
  });

  it('should phrase the loading phase with the model and node, and clear it on generating', () => {
    const withMeta = applyTurnEvent(pending, 'meta', META);

    const loading = applyTurnEvent(withMeta, 'status', { phase: 'loading_model', model: 'llama3.1:8b', message: 'x' });
    expect(loading.live).toEqual({ phase: 'loading_model', text: 'Loading llama3.1:8b on Matt-PC…' });

    expect(applyTurnEvent(loading, 'status', { phase: 'generating' }).live).toBeNull();
  });

  it('should fall back to the server message for loading before meta, and show failover text', () => {
    expect(applyTurnEvent(pending, 'status', { phase: 'loading_model', message: 'Loading it…' }).live.text).toBe('Loading it…');
    expect(applyTurnEvent(pending, 'status', { phase: 'failover', message: 'Trying Rig-2…' }).live).toEqual({
      phase: 'failover',
      text: 'Trying Rig-2…',
    });
  });

  it('should append thinking and token deltas', () => {
    let m = applyTurnEvent(pending, 'thinking', { content: 'Hm' });
    m = applyTurnEvent(m, 'thinking', { content: 'mm' });
    m = applyTurnEvent(m, 'token', { content: 'Hel' });
    m = applyTurnEvent(m, 'token', { content: 'lo' });

    expect(m).toMatchObject({ thinking: 'Hmmm', content: 'Hello', live: null });
  });

  it('should complete the message with usage and stats on done', () => {
    const m = applyTurnEvent(applyTurnEvent(pending, 'meta', META), 'done', {
      messageId: 'a9', promptTokens: 10, completionTokens: 5, contextLength: 4096, finishReason: 'length',
      contextOverflow: true, stats: { ttftMs: 100, tokensPerSecond: 30.5 },
    });

    expect(m).toMatchObject({ id: 'a9', status: 'complete', contextOverflow: true });
    expect(m.generation).toMatchObject({
      model: 'llama3.1:8b', promptTokens: 10, completionTokens: 5, contextLength: 4096,
      finishReason: 'length', ttftMs: 100, tokensPerSecond: 30.5,
    });
  });

  it('should record the error, its code and the alternatives on error', () => {
    const m = applyTurnEvent({ ...pending, content: 'partial' }, 'error', {
      messageId: 'a2', code: 'NODE_OFFLINE', message: 'offline', retryable: true,
      alternatives: [{ nodeId: 'n2', nodeName: 'Rig-2' }],
    });

    expect(m).toMatchObject({
      id: 'a2', status: 'error', content: 'partial', error: { code: 'NODE_OFFLINE', message: 'offline' },
      alternatives: [{ nodeId: 'n2', nodeName: 'Rig-2' }],
    });
  });

  it('should leave the message untouched for unknown events', () => {
    expect(applyTurnEvent(pending, 'tool_call', { id: '1' })).toBe(pending);
  });
});
