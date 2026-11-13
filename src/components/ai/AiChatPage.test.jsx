import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiChatPage from './AiChatPage';
import { makeCatalogue, makeConversation, makeMessage, NODE_PC, NODE_RIG } from './aiTestData';
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../services/aiChatApi';

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(),
}));

vi.mock('../../services/aiChatApi', () => ({
  listModels: vi.fn(),
  warmUp: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  generateTitle: vi.fn(),
  getContextUsage: vi.fn(),
  sendMessage: vi.fn(),
}));

const LLAMA_AUTO = { model: 'llama3.1:8b', nodeId: null };

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
}

function renderPage(url = '/ai') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/ai"
          element={
            <>
              <AiChatPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Scripts the next sendMessage call: the test pushes events and finishes the stream by hand.
 * Aborting the request rejects it with an AbortError, like a real fetch.
 */
function scriptTurn() {
  const turn = { calls: 0 };
  api.sendMessage.mockImplementationOnce(
    (token, conversationId, body, { signal, onEvent }) =>
      new Promise((resolve, reject) => {
        turn.token = token;
        turn.conversationId = conversationId;
        turn.body = body;
        turn.signal = signal;
        turn.emit = (name, data) => act(async () => onEvent(name, data));
        turn.finish = (event, data) => act(async () => resolve({ event, data }));
        turn.fail = (error) => act(async () => reject(error));
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        turn.started = true;
      })
  );
  turn.whenStarted = () => waitFor(() => expect(turn.started).toBe(true));
  return turn;
}

const META = {
  conversationId: 'c-new',
  userMessageId: 'u1',
  assistantMessageId: 'a1',
  nodeId: NODE_PC,
  nodeName: 'Matt-PC',
  model: 'llama3.1:8b',
  auto: true,
  presetId: null,
  contextLength: 8192,
  context: { promptTokensEstimate: 10, trimmedCount: 0, summaryActive: false, imagesOmitted: 0 },
};
const DONE = {
  messageId: 'a1',
  userMessageId: 'u1',
  promptTokens: 400,
  completionTokens: 100,
  contextLength: 8192,
  finishReason: 'stop',
  contextOverflow: false,
  stats: { ttftMs: 300, totalMs: 2000, loadMs: 0, thinkingMs: null, tokensPerSecond: 40 },
};

const typeAndSend = async (user, text) => {
  const box = screen.getByRole('textbox', { name: 'Message' });
  await user.type(box, text);
  await user.keyboard('{Enter}');
};

const waitForReady = () => waitFor(() => expect(screen.getByRole('button', { name: /llama3\.1:8b|qwen3|select a model/i })).toBeInTheDocument());

beforeEach(() => {
  useAuth.mockReturnValue({ token: 'jwt' });
  api.listModels.mockResolvedValue(makeCatalogue());
  api.getPreferences.mockResolvedValue({ lastTarget: LLAMA_AUTO, lastPresetId: null });
  api.updatePreferences.mockImplementation(async (token, prefs) => ({ ...prefs }));
  api.warmUp.mockResolvedValue({ state: 'loaded' });
  api.listConversations.mockResolvedValue({ items: [], hasMore: false });
  api.createConversation.mockResolvedValue(makeConversation({ id: 'c-new', title: 'New chat', titleSource: 'default', messageCount: 0 }));
  api.generateTitle.mockResolvedValue(makeConversation({ id: 'c-new', title: 'Bell chat', titleSource: 'auto' }));
  api.updateConversation.mockImplementation(async (token, id, patch) => makeConversation({ id, ...patch }));
  api.getContextUsage.mockResolvedValue({ model: 'qwen3:14b', nodeId: NODE_PC, contextLength: 16384, usedTokens: 2048 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(api.sendMessage).mockReset();
  window.localStorage.clear();
});

describe('AiChatPage new chat', () => {
  it('should start on the last target when the catalogue still has that model', async () => {
    api.getPreferences.mockResolvedValue({ lastTarget: { model: 'qwen3:14b', nodeId: NODE_PC } });
    renderPage();

    expect(await screen.findByRole('button', { name: /qwen3:14b\s*Matt-PC/ })).toBeInTheDocument();
    expect(screen.getByText(/how can i help/i)).toBeInTheDocument();
  });

  it('should fall back to the loaded model when the last target is gone', async () => {
    api.getPreferences.mockResolvedValue({ lastTarget: { model: 'deleted:1b', nodeId: null } });
    renderPage();

    expect(await screen.findByRole('button', { name: /llama3\.1:8b\s*Auto/ })).toBeInTheDocument();
  });

  it('should not allow sending until a model is available', async () => {
    api.listModels.mockResolvedValue({ generatedAt: 'x', nodes: [], models: [] });
    renderPage();

    expect(await screen.findByText(/no ai nodes are online/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('placeholder', expect.stringMatching(/pick a model/i));
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('should create the conversation lazily on the first send, then stream into it', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    expect(api.createConversation).not.toHaveBeenCalled();

    await typeAndSend(user, 'How do I debounce?');
    await turn.whenStarted();

    expect(api.createConversation).toHaveBeenCalledWith('jwt', { target: LLAMA_AUTO }, expect.anything());
    expect(turn.conversationId).toBe('c-new');
    expect(screen.getByTestId('search')).toHaveTextContent('?c=c-new');
    expect(screen.getByText('How do I debounce?')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
    // The creation put the id in the URL, but the page must not reload what it already holds.
    expect(api.getConversation).not.toHaveBeenCalled();
  });

  it('should send only the new message and the target, never the history', async () => {
    const user = userEvent.setup();
    const first = scriptTurn();
    renderPage();
    await waitForReady();

    await typeAndSend(user, 'First');
    await first.whenStarted();
    await first.emit('meta', META);
    await first.emit('token', { content: 'Reply' });
    await first.finish('done', DONE);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument());

    const second = scriptTurn();
    await typeAndSend(user, 'Second');
    await second.whenStarted();

    expect(second.body).toEqual({ content: 'Second', target: LLAMA_AUTO });
    expect(api.createConversation).toHaveBeenCalledTimes(1);
  });

  it('should send on Enter and keep a newline on Shift+Enter', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();

    const box = screen.getByRole('textbox', { name: 'Message' });
    await user.type(box, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(box).toHaveValue('line one\nline two');
    expect(api.sendMessage).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    await turn.whenStarted();

    expect(turn.body.content).toBe('line one\nline two');
  });

  it('should render the stream live: loading phase, thinking block, tokens, then done', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Think about it');
    await turn.whenStarted();

    // Waiting for the first event.
    expect(screen.getByRole('status', { name: /waiting for a reply/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    await turn.emit('meta', META);
    await turn.emit('status', { phase: 'loading_model', nodeId: NODE_PC, model: 'llama3.1:8b', message: 'Loading…' });
    expect(screen.getByText('Loading llama3.1:8b on Matt-PC…')).toBeInTheDocument();
    // The tag appears as soon as the node is known.
    expect(screen.getByTestId('generation-tag')).toHaveTextContent('llama3.1:8b · Matt-PC');
    expect(screen.getByTestId('generation-tag')).toHaveTextContent('auto');

    await turn.emit('status', { phase: 'generating' });
    expect(screen.queryByText(/Loading llama3.1:8b on/)).not.toBeInTheDocument();

    await turn.emit('thinking', { content: 'Let me ' });
    await turn.emit('thinking', { content: 'consider.' });
    const toggle = screen.getByRole('button', { name: /thinking…/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /reasoning/i })).toHaveTextContent('Let me consider.');

    await turn.emit('token', { content: 'Hello ' });
    await turn.emit('token', { content: '**world**' });
    // Collapsed once tokens start, expandable afterwards.
    expect(screen.getByRole('button', { name: /thinking/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /reasoning/i })).not.toBeInTheDocument();
    expect(screen.getByText('world').tagName).toBe('STRONG');
    await user.click(screen.getByRole('button', { name: /thinking/i }));
    expect(screen.getByRole('region', { name: /reasoning/i })).toHaveTextContent('Let me consider.');

    await turn.emit('done', DONE);
    await turn.finish('done', DONE);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument());
    expect(screen.getByRole('img', { name: /Context: 500 \/ 8,192 tokens/ })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /waiting/i })).not.toBeInTheDocument();
  });

  it('should open links from replies in a new tab', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'link?');
    await turn.whenStarted();
    await turn.emit('meta', META);
    await turn.emit('token', { content: 'See [docs](https://example.com).' });
    await turn.finish('done', DONE);

    const link = await screen.findByRole('link', { name: 'docs' });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('should abort the request when Stop is pressed and keep the partial reply', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Write a long story');
    await turn.whenStarted();
    await turn.emit('meta', META);
    await turn.emit('token', { content: 'Once upon' });

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(turn.signal.aborted).toBe(true);
    expect(await screen.findByText('Stopped.')).toBeInTheDocument();
    expect(screen.getByText('Once upon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show an error event with its message and code and keep the partial text', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    await turn.emit('meta', META);
    await turn.emit('token', { content: 'Partial answer' });
    const error = {
      messageId: 'a1', userMessageId: 'u1', code: 'NODE_UNREACHABLE', message: 'Matt-PC went away.',
      retryable: true, alternatives: [{ nodeId: NODE_RIG, nodeName: 'Rig-2', model: 'llama3.1:8b' }],
    };
    await turn.emit('error', error);
    await turn.finish('error', error);

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Matt-PC went away.');
    expect(alert).toHaveTextContent('NODE_UNREACHABLE');
    expect(screen.getByText('Partial answer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('should mark the reply as failed when the connection drops mid-stream', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    await turn.emit('meta', META);
    await turn.emit('token', { content: 'Half a sent' });

    await turn.fail(Object.assign(new Error('The connection closed before the reply finished.'), { code: 'STREAM_CLOSED' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The connection closed before the reply finished.');
    expect(alert).toHaveTextContent('STREAM_CLOSED');
    expect(screen.getByText('Half a sent')).toBeInTheDocument();
  });

  it('should undo the optimistic messages and restore the draft when the API rejects the send', async () => {
    const user = userEvent.setup();
    api.sendMessage.mockRejectedValueOnce(Object.assign(new Error('A reply is already being generated.'), { status: 409 }));
    renderPage();
    await waitForReady();

    await typeAndSend(user, 'Please answer');

    expect(await screen.findByRole('alert')).toHaveTextContent('A reply is already being generated.');
    expect(screen.queryByText('Please answer', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Please answer');
  });

  it('should call the title endpoint once after the first reply and update the sidebar and header', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    api.listConversations
      .mockResolvedValueOnce({ items: [], hasMore: false })
      .mockResolvedValue({ items: [makeConversation({ id: 'c-new', title: 'Bell chat' })], hasMore: false });
    renderPage();
    await waitForReady();

    await typeAndSend(user, 'Tell me about bells');
    await turn.whenStarted();
    await turn.emit('meta', META);
    await turn.emit('token', { content: 'Bells ring.' });
    await turn.emit('done', DONE);
    await turn.finish('done', DONE);

    await waitFor(() => expect(api.generateTitle).toHaveBeenCalledWith('jwt', 'c-new'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Bell chat' })).toBeInTheDocument();
    expect(await within(screen.getByRole('navigation', { name: /conversation list/i })).findByText('Bell chat')).toBeInTheDocument();

    const second = scriptTurn();
    await typeAndSend(user, 'And more?');
    await second.whenStarted();
    await second.emit('meta', META);
    await second.emit('done', DONE);
    await second.finish('done', DONE);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument());

    expect(api.generateTitle).toHaveBeenCalledTimes(1);
  });

  it('should not ask for a title when the first reply was stopped', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    await turn.emit('meta', META);

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await screen.findByText('Stopped before any reply.');

    expect(api.generateTitle).not.toHaveBeenCalled();
  });
});

describe('AiChatPage opened conversation', () => {
  const stored = () => [
    makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'What is Ollama?' }),
    makeMessage({
      id: 'a1', seq: 2, role: 'assistant', content: 'A local model runner.', thinking: 'They want a definition.',
      generation: {
        nodeId: NODE_PC, nodeName: 'Matt-PC', model: 'qwen3:14b', auto: true, contextLength: 16384,
        promptTokens: 1000, completionTokens: 200, thinkingMs: 2400,
      },
    }),
    makeMessage({
      id: 'u2', seq: 3, role: 'user', content: 'And the bell?',
    }),
    makeMessage({
      id: 'a2', seq: 4, role: 'assistant', content: '', status: 'error',
      error: { code: 'NODE_OFFLINE', message: 'Garage-Laptop is offline.' },
      generation: { nodeId: 'node-garage', nodeName: 'Garage-Laptop', model: 'qwen3:14b', auto: false },
    }),
    makeMessage({
      id: 'u3', seq: 5, role: 'user', content: 'Try again',
    }),
    makeMessage({
      id: 'a3', seq: 6, role: 'assistant', content: 'Half of it', status: 'cancelled',
      generation: { nodeId: NODE_RIG, nodeName: 'Rig-2', model: 'llama3.1:8b', auto: false },
    }),
  ];

  beforeEach(() => {
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c9', title: 'Ollama basics', target: { model: 'qwen3:14b', nodeId: NODE_PC } }),
      summary: null,
      context: { model: 'qwen3:14b', nodeId: NODE_PC, contextLength: 16384, usedTokens: 3000, totalTokens: 3000, fits: true, trimmedCount: 0 },
      messages: stored(),
    });
  });

  it('should restore the conversation named in the URL from the server', async () => {
    renderPage('/ai?c=c9');

    expect(await screen.findByText('What is Ollama?')).toBeInTheDocument();
    expect(api.getConversation).toHaveBeenCalledWith('jwt', 'c9', expect.anything());
    expect(screen.getByRole('heading', { level: 1, name: 'Ollama basics' })).toBeInTheDocument();
    expect(screen.getByText('A local model runner.')).toBeInTheDocument();
    // The picker shows the conversation's own target, not the last-used one.
    expect(screen.getByRole('button', { name: /qwen3:14b\s*Matt-PC/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Context: 3,000 \/ 16,384 tokens/ })).toBeInTheDocument();
  });

  it('should tag assistant messages with model, node and auto', async () => {
    renderPage('/ai?c=c9');
    await screen.findByText('What is Ollama?');

    const tags = screen.getAllByTestId('generation-tag');

    expect(tags.map((t) => t.textContent)).toEqual([
      'qwen3:14b · Matt-PCauto',
      'qwen3:14b · Garage-Laptop',
      'llama3.1:8b · Rig-2',
    ]);
  });

  it('should show stored thinking collapsed and expandable', async () => {
    const user = userEvent.setup();
    renderPage('/ai?c=c9');
    await screen.findByText('What is Ollama?');

    const toggle = screen.getByRole('button', { name: /thought for 2\.4s/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(screen.getByRole('region', { name: /reasoning/i })).toHaveTextContent('They want a definition.');
  });

  it('should render cancelled and errored messages distinctly', async () => {
    renderPage('/ai?c=c9');
    await screen.findByText('What is Ollama?');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Garage-Laptop is offline.');
    expect(alert).toHaveTextContent('NODE_OFFLINE');
    expect(screen.getByText('Half of it')).toBeInTheDocument();
    expect(screen.getByText('Stopped.')).toBeInTheDocument();
  });

  it('should show a recoverable error when the conversation cannot be loaded', async () => {
    const user = userEvent.setup();
    api.getConversation.mockRejectedValue(Object.assign(new Error('Conversation not found'), { status: 404 }));
    renderPage('/ai?c=gone');

    expect(await screen.findByText('That conversation no longer exists.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'New chat' }));

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
  });

  it('should send on the stored conversation without creating a new one', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage('/ai?c=c9');
    await screen.findByText('What is Ollama?');

    await typeAndSend(user, 'Next question');
    await turn.whenStarted();

    expect(api.createConversation).not.toHaveBeenCalled();
    expect(turn.conversationId).toBe('c9');
    expect(turn.body).toEqual({ content: 'Next question', target: { model: 'qwen3:14b', nodeId: NODE_PC } });
  });

  it('should switch conversations from the sidebar, putting the id in the URL', async () => {
    const user = userEvent.setup();
    api.listConversations.mockResolvedValue({
      items: [makeConversation({ id: 'c9', title: 'Ollama basics' }), makeConversation({ id: 'c10', title: 'Other chat' })],
      hasMore: false,
    });
    api.getConversation.mockImplementation(async (token, id) => ({
      ...makeConversation({ id, title: id === 'c10' ? 'Other chat' : 'Ollama basics' }),
      context: null,
      messages: id === 'c10' ? [makeMessage({ id: 'x1', content: 'Hello from the other chat' })] : stored(),
    }));
    renderPage('/ai?c=c9');
    await screen.findByText('What is Ollama?');

    await user.click(await screen.findByRole('button', { name: 'Other chat' }));

    expect(await screen.findByText('Hello from the other chat')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?c=c10');
    expect(screen.queryByText('What is Ollama?')).not.toBeInTheDocument();
  });

  it('should abort a running reply when another conversation is opened', async () => {
    const user = userEvent.setup();
    api.listConversations.mockResolvedValue({
      items: [makeConversation({ id: 'c9', title: 'Ollama basics' }), makeConversation({ id: 'c10', title: 'Other chat' })],
      hasMore: false,
    });
    const turn = scriptTurn();
    renderPage('/ai?c=c9');
    await screen.findByText('What is Ollama?');
    await typeAndSend(user, 'Next question');
    await turn.whenStarted();
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c10', title: 'Other chat' }), context: null, messages: [makeMessage({ id: 'x1', content: 'Other content' })],
    });

    await user.click(await screen.findByRole('button', { name: 'Other chat' }));

    expect(turn.signal.aborted).toBe(true);
    expect(await screen.findByText('Other content')).toBeInTheDocument();
    expect(screen.queryByText('Stopped.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});

describe('AiChatPage sidebar', () => {
  const ITEMS = [
    makeConversation({ id: 'p1', title: 'Pinned chat', pinned: true }),
    makeConversation({ id: 'r1', title: 'Recent chat' }),
  ];

  beforeEach(() => {
    api.listConversations.mockResolvedValue({ items: ITEMS, hasMore: false });
    api.getConversation.mockImplementation(async (token, id) => ({
      ...ITEMS.find((c) => c.id === id), context: null, messages: [makeMessage({ id: 'x', content: `Body of ${id}` })],
    }));
  });

  it('should search with the debounced term sent as q', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'Recent chat' });
    api.listConversations.mockClear();

    await user.type(screen.getByRole('searchbox', { name: /search conversations/i }), 'bell');

    await waitFor(() => expect(api.listConversations).toHaveBeenCalledWith('jwt', expect.objectContaining({ q: 'bell' })));
    // Four keystrokes, one request: the term is debounced.
    expect(api.listConversations).toHaveBeenCalledTimes(1);
  });

  it('should rename a conversation and update the open header', async () => {
    const user = userEvent.setup();
    api.updateConversation.mockImplementation(async (token, id, patch) => ({ ...ITEMS.find((c) => c.id === id), ...patch }));
    renderPage('/ai?c=r1');
    await screen.findByText('Body of r1');

    await user.click(screen.getByRole('button', { name: 'Actions for Recent chat' }));
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /conversation title/i });
    await user.clear(input);
    await user.type(input, 'Renamed{Enter}');

    await waitFor(() => expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'r1', { title: 'Renamed' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Renamed' })).toBeInTheDocument();
  });

  it('should pin a conversation through the API and reload the order', async () => {
    const user = userEvent.setup();
    api.updateConversation.mockImplementation(async (token, id, patch) => ({ ...ITEMS.find((c) => c.id === id), ...patch }));
    renderPage();
    await screen.findByRole('button', { name: 'Recent chat' });
    api.listConversations.mockClear();

    await user.click(screen.getByRole('button', { name: 'Actions for Recent chat' }));
    await user.click(screen.getByRole('menuitem', { name: /^pin/i }));

    await waitFor(() => expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'r1', { pinned: true }));
    await waitFor(() => expect(api.listConversations).toHaveBeenCalled());
  });

  it('should delete after a confirmation and leave the page if the open chat was deleted', async () => {
    const user = userEvent.setup();
    api.deleteConversation.mockResolvedValue({ deleted: true });
    renderPage('/ai?c=r1');
    await screen.findByText('Body of r1');

    await user.click(screen.getByRole('button', { name: 'Actions for Recent chat' }));
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    expect(api.deleteConversation).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => expect(api.deleteConversation).toHaveBeenCalledWith('jwt', 'r1'));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
    expect(screen.queryByText('Body of r1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recent chat' })).not.toBeInTheDocument();
    expect(screen.getByText(/how can i help/i)).toBeInTheDocument();
  });

  it('should start a fresh chat from New chat', async () => {
    const user = userEvent.setup();
    renderPage('/ai?c=r1');
    await screen.findByText('Body of r1');

    await user.click(screen.getByRole('button', { name: /^new chat$/i }));

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
    expect(screen.queryByText('Body of r1')).not.toBeInTheDocument();
    expect(screen.getByText(/how can i help/i)).toBeInTheDocument();
  });

  it('should collapse and reopen the sidebar', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await screen.findByRole('button', { name: 'Recent chat' });
    const root = container.querySelector('.ai-chat');
    expect(root).toHaveAttribute('data-sidebar', 'open');

    await user.click(screen.getByRole('button', { name: /hide conversations/i }));
    expect(root).toHaveAttribute('data-sidebar', 'closed');
    expect(window.localStorage.getItem('aiChat.sidebar')).toBe('closed');

    await user.click(screen.getByRole('button', { name: /show conversations/i }));
    expect(root).toHaveAttribute('data-sidebar', 'open');
  });
});

describe('AiChatPage picker integration', () => {
  it('should warm the model up (debounced) and save it to the preferences when there is no conversation', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForReady();

    await user.click(screen.getByRole('button', { name: /llama3\.1:8b/ }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('option', { name: /qwen3:14b/ })[1]);

    expect(await screen.findByRole('button', { name: /qwen3:14b\s*Matt-PC/ })).toBeInTheDocument();
    await waitFor(() => expect(api.warmUp).toHaveBeenCalledWith('jwt', { model: 'qwen3:14b', nodeId: NODE_PC }));
    expect(api.updatePreferences).toHaveBeenCalledWith('jwt', { lastTarget: { model: 'qwen3:14b', nodeId: NODE_PC } });
    expect(api.updateConversation).not.toHaveBeenCalled();
    expect(api.createConversation).not.toHaveBeenCalled();
  });

  it('should warm up once for rapid selections, on selection and not on hover', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForReady();
    api.warmUp.mockClear();

    await user.click(screen.getByRole('button', { name: /llama3\.1:8b/ }));
    await user.hover(within(screen.getByRole('dialog')).getAllByRole('option', { name: /qwen3:14b/ })[0]);
    await new Promise((r) => setTimeout(r, 500));
    expect(api.warmUp).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole('dialog')).getAllByRole('option', { name: /qwen3:14b/ })[0]);
    await user.click(screen.getByRole('button', { name: /qwen3:14b/ }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('option', { name: /llama3\.2-vision/ })[0]);

    await waitFor(() => expect(api.warmUp).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(api.warmUp).toHaveBeenCalledWith('jwt', { model: 'llama3.2-vision:11b', nodeId: null });
  });

  it('should patch the conversation target and preflight the context when a conversation is open', async () => {
    const user = userEvent.setup();
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c9' }), context: null, messages: [makeMessage({ id: 'u1', content: 'Hi there' })],
    });
    renderPage('/ai?c=c9');
    await screen.findByText('Hi there');

    await user.click(screen.getByRole('button', { name: /llama3\.1:8b/ }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('option', { name: /qwen3:14b/ })[1]);

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { target: { model: 'qwen3:14b', nodeId: NODE_PC } })
    );
    expect(api.getContextUsage).toHaveBeenCalledWith('jwt', 'c9', { model: 'qwen3:14b', nodeId: NODE_PC });
    expect(api.updatePreferences).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('img', { name: /Context: 2,048 \/ 16,384 tokens/ })).toBeInTheDocument());
    await waitFor(() => expect(api.warmUp).toHaveBeenCalled());
  });

  it('should carry the changed target on the next send and tag the reply with the new node', async () => {
    const user = userEvent.setup();
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c9' }), context: null, messages: [makeMessage({ id: 'u1', content: 'Earlier question' })],
    });
    const turn = scriptTurn();
    renderPage('/ai?c=c9');
    await screen.findByText('Earlier question');

    await user.click(screen.getByRole('button', { name: /llama3\.1:8b/ }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('option', { name: /llama3\.1:8b/ })[2]);
    await typeAndSend(user, 'Now on Rig-2');
    await turn.whenStarted();
    await turn.emit('meta', { ...META, conversationId: 'c9', nodeId: NODE_RIG, nodeName: 'Rig-2', auto: false });

    expect(turn.body.target).toEqual({ model: 'llama3.1:8b', nodeId: NODE_RIG });
    expect(screen.getByTestId('generation-tag')).toHaveTextContent('llama3.1:8b · Rig-2');
  });

  it('should open the picker with Ctrl+K from the page', async () => {
    renderPage();
    await waitForReady();

    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });

    expect(await screen.findByRole('dialog', { name: /choose a model/i })).toBeInTheDocument();
  });
});
