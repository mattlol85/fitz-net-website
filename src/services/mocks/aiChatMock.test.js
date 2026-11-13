import { beforeEach, describe, expect, it } from 'vitest';
import { configureMock, getAttachmentBlob, handleRequest, handleStream, resetMock } from './aiChatMock';

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

  describe('part 2 paths', () => {
    const longConversation = async () => {
      const list = await get('/ai/conversations');
      return list.items.find((c) => c.title === 'Long design discussion');
    };

    it('should report trimmed messages for the small-window model and none for a big one', async () => {
      const conv = await longConversation();

      const small = await get(`/ai/conversations/${conv.id}/context`, { model: 'phi3:mini' });
      const big = await get(`/ai/conversations/${conv.id}/context`, { model: 'llama3.1:8b' });

      expect(small.trimmedCount).toBeGreaterThan(0);
      expect(small.fits).toBe(false);
      expect(small.contextLength).toBe(1024);
      expect(big.trimmedCount).toBe(0);
    });

    it('should summarise the trimmed turns, then report a summary in use with nothing trimmed', async () => {
      const conv = await longConversation();
      await handleRequest('PATCH', `/ai/conversations/${conv.id}`, { body: { target: { model: 'phi3:mini', nodeId: null } } });

      const result = await post(`/ai/conversations/${conv.id}/summarize`);

      expect(result.summary.coversThroughSeq).toBeGreaterThan(0);
      expect(result.context).toMatchObject({ trimmedCount: 0, summaryActive: true });
      await expect(post(`/ai/conversations/${conv.id}/summarize`)).rejects.toMatchObject({ status: 409 });
    });

    it('should announce trimming in meta and flag an overflow in done', async () => {
      const conv = await longConversation();
      await handleRequest('PATCH', `/ai/conversations/${conv.id}`, { body: { target: { model: 'phi3:mini', nodeId: null } } });

      const { events, result } = await runTurn(conv.id, { content: '/overflow please' });

      expect(events.find(([name]) => name === 'meta')[1].context.trimmedCount).toBeGreaterThan(0);
      expect(result.data.contextOverflow).toBe(true);
      expect(result.data.stats.totalMs).toBeGreaterThanOrEqual(0);
    });

    it('should regenerate with a new target, dropping the old answer and anything after it', async () => {
      const catalogue = await get('/ai/models');
      const rig = catalogue.nodes.find((n) => n.name === 'Rig-2');
      const conv = await post('/ai/conversations', { target: LLAMA });
      await runTurn(conv.id, { content: 'First' });
      await runTurn(conv.id, { content: 'Second' });
      const before = await get(`/ai/conversations/${conv.id}`);

      const events = [];
      await handleStream(`/ai/conversations/${conv.id}/messages/${before.messages[1].id}/regenerate`, {
        target: { model: 'llama3.1:8b', nodeId: rig.id },
      }, { onEvent: (name, data) => events.push([name, data]) });

      const after = await get(`/ai/conversations/${conv.id}`);
      expect(after.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
      expect(after.messages[1].id).not.toBe(before.messages[1].id);
      expect(events.find(([name]) => name === 'meta')[1].nodeName).toBe('Rig-2');
      expect(after.target.nodeId).toBe(rig.id);
    });

    it('should edit a user message in place and truncate what follows', async () => {
      const conv = await post('/ai/conversations', { target: LLAMA });
      await runTurn(conv.id, { content: 'First' });
      await runTurn(conv.id, { content: 'Second' });
      const before = await get(`/ai/conversations/${conv.id}`);

      await handleStream(`/ai/conversations/${conv.id}/messages/${before.messages[0].id}/edit`, { content: 'First, reworded' });

      const after = await get(`/ai/conversations/${conv.id}`);
      expect(after.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
      expect(after.messages[0]).toMatchObject({ id: before.messages[0].id, content: 'First, reworded' });
      expect(after.messages[0].editedAt).toBeTruthy();
    });
  });

  describe('part 3 paths', () => {
    const tokenFor = (sub) => `x.${btoa(JSON.stringify({ sub }))}.y`;
    const as = (sub) => ({
      get: (path, query) => handleRequest('GET', path, { query, token: tokenFor(sub) }),
      send: (method, path, body) => handleRequest(method, path, { body, token: tokenFor(sub) }),
    });

    it('should show private presets only to their owner and shared ones to everyone', async () => {
      const testuser = (await as('testuser').get('/ai/presets')).items.map((p) => p.name).sort();
      const admin = (await as('changmin').get('/ai/presets')).items.map((p) => p.name).sort();

      expect(testuser).toEqual(['Code reviewer', 'House style']);
      expect(admin).toEqual(['House style', 'Quick answers']);
    });

    it('should let only an admin create or change shared presets', async () => {
      const user = as('testuser');
      await expect(user.send('POST', '/ai/presets', { name: 'Team', visibility: 'shared' })).rejects.toMatchObject({ status: 403 });

      const shared = (await user.get('/ai/presets')).items.find((p) => p.name === 'House style');
      expect(shared.editable).toBe(false);
      await expect(user.send('PUT', `/ai/presets/${shared.id}`, { name: 'Hijacked' })).rejects.toMatchObject({ status: 403 });
      await expect(user.send('DELETE', `/ai/presets/${shared.id}`)).rejects.toMatchObject({ status: 403 });

      const admin = as('changmin');
      const created = await admin.send('POST', '/ai/presets', { name: 'Team', visibility: 'shared' });
      expect(created).toMatchObject({ visibility: 'shared', ownerUsername: 'changmin', editable: true });
      expect((await user.get('/ai/presets')).items.map((p) => p.name)).toContain('Team');
    });

    it('should validate presets with 400s and hide other users private presets with 404', async () => {
      const user = as('testuser');
      await expect(user.send('POST', '/ai/presets', { name: '' })).rejects.toMatchObject({ status: 400 });
      await expect(user.send('POST', '/ai/presets', { name: 'x', temperature: 3 })).rejects.toMatchObject({ status: 400 });
      await expect(user.send('POST', '/ai/presets', { name: 'x', numCtx: 100 })).rejects.toMatchObject({ status: 400 });

      const quick = (await as('changmin').get('/ai/presets')).items.find((p) => p.name === 'Quick answers');
      await expect(user.send('PUT', `/ai/presets/${quick.id}`, { name: 'Mine' })).rejects.toMatchObject({ status: 404 });
    });

    it('should copy a preset pinned model into the target when settings are set without a target', async () => {
      const admin = as('changmin');
      const quick = (await admin.get('/ai/presets')).items.find((p) => p.name === 'Quick answers');
      const conv = await admin.send('POST', '/ai/conversations', {});

      const patched = await admin.send('PATCH', `/ai/conversations/${conv.id}`, { settings: { presetId: quick.id, systemPrompt: null } });

      expect(patched.target).toEqual({ model: 'llama3.1:8b', nodeId: 'mock-node-mattpc' });
      const withTarget = await admin.send('POST', '/ai/conversations', {
        target: { model: 'phi3:mini', nodeId: null }, settings: { presetId: quick.id, systemPrompt: null },
      });
      expect(withTarget.target.model).toBe('phi3:mini');
    });

    it('should record the preset name on the reply', async () => {
      const house = (await as('testuser').get('/ai/presets')).items.find((p) => p.name === 'House style');
      const conv = await post('/ai/conversations', { target: LLAMA, settings: { presetId: house.id, systemPrompt: null } });

      await handleStream(`/ai/conversations/${conv.id}/messages`, { content: 'Hi' }, { token: tokenFor('testuser') });

      const detail = await get(`/ai/conversations/${conv.id}`);
      expect(detail.messages[1].generation).toMatchObject({ presetName: 'House style', presetId: house.id });
    });

    it('should hold uploaded images and reject a message with images on a model that cannot read them', async () => {
      const meta = await post('/ai/attachments', { name: 'a.jpg', mimeType: 'image/jpeg', dataBase64: btoa('abc') });
      const blob = await getAttachmentBlob(meta.id);
      expect(blob.type).toBe('image/jpeg');
      await expect(post('/ai/attachments', { name: 'a.gif', mimeType: 'image/gif', dataBase64: 'AAAA' })).rejects.toMatchObject({ status: 400 });

      const conv = await post('/ai/conversations', { target: LLAMA });
      const blind = await runTurn(conv.id, { content: 'What is this?', attachmentIds: [meta.id] });
      expect(blind.names).toEqual(['error']);
      expect(blind.result.data.code).toBe('MODEL_NOT_VISION');

      const seeing = await runTurn(conv.id, {
        content: 'And now?', attachmentIds: [meta.id], target: { model: 'llama3.2-vision:11b', nodeId: null },
      });
      expect(seeing.names.at(-1)).toBe('done');
      const detail = await get(`/ai/conversations/${conv.id}`);
      expect(detail.messages.find((m) => m.content === 'And now?').attachments[0].id).toBe(meta.id);
    });

    it('should count earlier images the model could not read in meta.context.imagesOmitted', async () => {
      const meta = await post('/ai/attachments', { name: 'a.jpg', mimeType: 'image/jpeg', dataBase64: btoa('abc') });
      const conv = await post('/ai/conversations', { target: { model: 'llama3.2-vision:11b', nodeId: null } });
      await runTurn(conv.id, { content: 'Look', attachmentIds: [meta.id] });

      const { events } = await runTurn(conv.id, { content: 'Text only now', target: LLAMA });

      expect(events.find(([name]) => name === 'meta')[1].context.imagesOmitted).toBe(1);
    });

    it('should store contextOverflow on the generation', async () => {
      const conv = await post('/ai/conversations', { target: LLAMA });
      await runTurn(conv.id, { content: '/overflow' });

      const detail = await get(`/ai/conversations/${conv.id}`);

      expect(detail.messages[1].generation.contextOverflow).toBe(true);
    });
  });
});
