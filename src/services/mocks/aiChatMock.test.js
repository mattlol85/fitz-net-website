import { beforeEach, describe, expect, it } from 'vitest';
import { configureMock, handleRequest, handleStream, resetMock } from './aiChatMock';

const LLAMA = { model: 'llama3.1:8b', nodeId: null };

const get = (path, query) => handleRequest('GET', path, { query });
const post = (path, body) => handleRequest('POST', path, { body });

async function runTurn(conversationId, body, options = {}) {
  const events = [];
  const result = await handleStream(`/ai/conversations/${conversationId}/messages`, body, {
    ...options,
    onEvent: (name, data) => events.push([name, data]),
  });
  return { events, names: events.map(([name]) => name), result };
}

describe('aiChatMock', () => {
  beforeEach(() => {
    resetMock();
    configureMock({ latencyMs: 0, tokenDelayMs: 0, thinkDelayMs: 0, loadDelayMs: 0 });
  });

  it('should expose three nodes: loaded, cold and offline, with Auto rows', async () => {
    const catalogue = await get('/ai/models');

    const byName = Object.fromEntries(catalogue.nodes.map((n) => [n.name, n]));
    expect(byName['Matt-PC'].models.find((m) => m.name === 'llama3.1:8b').loaded).toBe(true);
    expect(byName['Matt-PC'].models.find((m) => m.name === 'llama3.2-vision:11b').capabilities).toContain('vision');
    expect(byName['Rig-2'].models.find((m) => m.name === 'llama3.1:8b').loaded).toBe(false);
    expect(byName['Garage-Laptop'].status).toBe('OFFLINE');
    const auto = catalogue.models.find((m) => m.name === 'llama3.1:8b');
    expect(auto.nodeIds).toHaveLength(2);
    expect(auto.autoNodeId).toBe(byName['Matt-PC'].id);
    expect(auto.loadedOn).toEqual([byName['Matt-PC'].id]);
    expect(catalogue.models.find((m) => m.name === 'phi3:mini').nodeIds).toEqual([byName['Rig-2'].id]);
  });

  it('should stream meta, generating, tokens and done for a warm model', async () => {
    const conversation = await post('/ai/conversations', { target: LLAMA });

    const { names, events, result } = await runTurn(conversation.id, { content: 'Hello there' });

    expect(names[0]).toBe('meta');
    expect(names).toContain('token');
    expect(names).not.toContain('thinking');
    expect(events.find(([, d]) => d.phase === 'loading_model')).toBeUndefined();
    expect(names.at(-1)).toBe('done');
    expect(result.data.completionTokens).toBeGreaterThan(0);
    const detail = await get(`/ai/conversations/${conversation.id}`);
    expect(detail.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(detail.messages[1]).toMatchObject({ status: 'complete', generation: { model: 'llama3.1:8b', auto: true } });
    expect(detail.title).toBe('Hello there');
  });

  it('should report a loading phase for a cold model and thinking for a thinking model', async () => {
    const conversation = await post('/ai/conversations', { target: { model: 'qwen3:14b', nodeId: null } });

    const { events, names } = await runTurn(conversation.id, { content: 'Why?' });

    const phases = events.filter(([name]) => name === 'status').map(([, d]) => d.phase);
    expect(phases).toEqual(['loading_model', 'generating']);
    expect(events.find(([, d]) => d.phase === 'loading_model')[1].message).toMatch(/Loading qwen3:14b on/);
    expect(names).toContain('thinking');
    expect(names.indexOf('thinking')).toBeLessThan(names.indexOf('token'));
  });

  it('should end with NODE_OFFLINE and alternatives when the target node is offline', async () => {
    const catalogue = await get('/ai/models');
    const garage = catalogue.nodes.find((n) => n.name === 'Garage-Laptop');
    const conversation = await post('/ai/conversations', { target: { model: 'llama3.1:8b', nodeId: garage.id } });

    const { names, result } = await runTurn(conversation.id, { content: 'Anyone home?' });

    expect(names).toEqual(['error']);
    expect(result.data.code).toBe('NODE_OFFLINE');
    expect(result.data.alternatives.map((a) => a.nodeName)).toEqual(['Matt-PC', 'Rig-2']);
    const detail = await get(`/ai/conversations/${conversation.id}`);
    expect(detail.messages[1]).toMatchObject({ status: 'error', error: { code: 'NODE_OFFLINE' } });
  });

  it('should stop streaming and keep the partial reply when aborted', async () => {
    configureMock({ tokenDelayMs: 5 });
    const conversation = await post('/ai/conversations', { target: LLAMA });
    const controller = new AbortController();
    const received = [];

    const promise = handleStream(
      `/ai/conversations/${conversation.id}/messages`,
      { content: 'Long one' },
      {
        signal: controller.signal,
        onEvent: (name) => {
          received.push(name);
          if (received.filter((n) => n === 'token').length === 2) controller.abort();
        },
      }
    );

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(received.filter((n) => n === 'token')).toHaveLength(2);
    expect(received).not.toContain('done');
    const detail = await get(`/ai/conversations/${conversation.id}`);
    expect(detail.messages[1].status).toBe('cancelled');
    expect(detail.messages[1].content.length).toBeGreaterThan(0);
  });

  it('should require a target and reject empty messages', async () => {
    const conversation = await post('/ai/conversations', {});

    await expect(runTurn(conversation.id, { content: 'hi' })).rejects.toMatchObject({ status: 400 });
    await expect(runTurn(conversation.id, { content: '  ', target: LLAMA })).rejects.toMatchObject({ status: 400 });
  });

  it('should keep pinned conversations first and search titles and message content', async () => {
    const all = await get('/ai/conversations');
    expect(all.items[0].pinned).toBe(true);

    const byTitle = await get('/ai/conversations', { q: 'garage' });
    expect(byTitle.items.map((c) => c.title)).toEqual(['Garage laptop test (node offline)']);

    const byContent = await get('/ai/conversations', { q: 'debounce the esp32' });
    expect(byContent.items).toHaveLength(1);
    expect(byContent.items[0].matchSnippet).toMatch(/debounce the ESP32/i);
  });

  it('should patch, delete and 404 conversations', async () => {
    const created = await post('/ai/conversations', {});

    const renamed = await handleRequest('PATCH', `/ai/conversations/${created.id}`, {
      body: { title: 'Mine', pinned: true },
    });
    expect(renamed).toMatchObject({ title: 'Mine', titleSource: 'user', pinned: true });

    expect(await handleRequest('DELETE', `/ai/conversations/${created.id}`)).toEqual({ deleted: true });
    await expect(get(`/ai/conversations/${created.id}`)).rejects.toMatchObject({ status: 404 });
  });

  it('should warm a cold model so the catalogue then shows it loaded', async () => {
    const catalogue = await get('/ai/models');
    const rig = catalogue.nodes.find((n) => n.name === 'Rig-2');

    const warm = await post('/ai/warmup', { model: 'phi3:mini', nodeId: rig.id });
    expect(warm.state).toBe('loading');
    await new Promise((r) => setTimeout(r, 5));

    const after = await get('/ai/models');
    const phi = after.nodes.find((n) => n.name === 'Rig-2').models.find((m) => m.name === 'phi3:mini');
    expect(phi.loaded).toBe(true);
    expect((await post('/ai/warmup', { model: 'phi3:mini', nodeId: rig.id })).state).toBe('loaded');
  });

  it('should remember the last target in the preferences', async () => {
    await handleRequest('PUT', '/ai/preferences', { body: { lastTarget: { model: 'phi3:mini', nodeId: null } } });

    expect((await get('/ai/preferences')).lastTarget).toEqual({ model: 'phi3:mini', nodeId: null });
  });
});
