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
  regenerateMessage: vi.fn(),
  editMessage: vi.fn(),
  summarizeConversation: vi.fn(),
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
function scriptTurn(mock = api.sendMessage) {
  const turn = { calls: 0 };
  // sendMessage(token, id, body, options); regenerate/edit(token, id, messageId, body, options).
  mock.mockImplementationOnce(
    (...args) =>
      new Promise((resolve, reject) => {
        const { signal, onEvent } = args.at(-1);
        turn.token = args[0];
        turn.conversationId = args[1];
        turn.messageId = args.length === 5 ? args[2] : undefined;
        turn.body = args.at(-2);
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
  [api.sendMessage, api.regenerateMessage, api.editMessage, api.summarizeConversation].forEach((fn) => fn.mockReset());
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
    expect(await screen.findByText('Stopped')).toBeInTheDocument();
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
    await screen.findByText('Stopped before any reply');

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

    expect(tags.map((t) => [...t.querySelectorAll('.ai-chat__chip')].map((c) => c.textContent).join('|'))).toEqual([
      'qwen3:14b · Matt-PC|auto',
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
    expect(screen.getByText('Stopped')).toBeInTheDocument();
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
    expect(screen.queryByText('Stopped')).not.toBeInTheDocument();
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

// --- Part 2: message controls, code blocks, stats, context window, failover -----------------------

const gen = (extra = {}) => ({
  nodeId: NODE_PC,
  nodeName: 'Matt-PC',
  model: 'llama3.1:8b',
  auto: false,
  contextLength: 8192,
  ...extra,
});

/** u1 -> a1 -> u2 -> a2, the last answer containing Markdown, a thought and a code fence. */
const thread = (overrides = {}) => [
  makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'First question' }),
  makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'First answer', generation: gen() }),
  makeMessage({ id: 'u2', seq: 3, role: 'user', content: 'Second question' }),
  makeMessage({
    id: 'a2', seq: 4, role: 'assistant', content: 'Second **bold** answer', thinking: 'secret reasoning',
    generation: gen(), ...overrides,
  }),
];

function openThread(messages = thread(), detail = {}) {
  api.getConversation.mockResolvedValue({
    ...makeConversation({ id: 'c9', target: { model: 'llama3.1:8b', nodeId: null } }),
    summary: null,
    context: null,
    messages,
    ...detail,
  });
  return renderPage('/ai?c=c9');
}

const assistantMessage = (index) => screen.getAllByLabelText('Matt-GPT')[index];
const userMessage = (index) => screen.getAllByLabelText('You')[index];

describe('AiChatPage message controls', () => {
  it('should copy the raw markdown of an assistant message, not its thinking', async () => {
    const user = userEvent.setup();
    openThread();
    await screen.findByText('First question');

    await user.click(within(assistantMessage(1)).getByRole('button', { name: 'Copy message' }));

    expect(await navigator.clipboard.readText()).toBe('Second **bold** answer');
    expect(within(assistantMessage(1)).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('should copy a user message', async () => {
    const user = userEvent.setup();
    openThread();
    await screen.findByText('First question');

    await user.click(within(userMessage(0)).getByRole('button', { name: 'Copy message' }));

    expect(await navigator.clipboard.readText()).toBe('First question');
  });

  it('should regenerate the last answer straight away on the current target', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn(api.regenerateMessage);
    openThread();
    await screen.findByText('First question');

    await user.click(within(assistantMessage(1)).getByRole('button', { name: 'Regenerate' }));
    await turn.whenStarted();

    expect(screen.queryByRole('group', { name: /confirm regenerate/i })).not.toBeInTheDocument();
    expect(turn.conversationId).toBe('c9');
    expect(turn.messageId).toBe('a2');
    expect(turn.body).toEqual({ target: { model: 'llama3.1:8b', nodeId: null } });
    expect(screen.queryByText('Second **bold** answer')).not.toBeInTheDocument();
    expect(screen.getByText('First answer')).toBeInTheDocument();

    await turn.emit('meta', { ...META, conversationId: 'c9', assistantMessageId: 'a3', userMessageId: 'u2' });
    await turn.emit('token', { content: 'A better answer' });
    await turn.emit('done', DONE);
    await turn.finish('done', DONE);

    expect(await screen.findByText('A better answer')).toBeInTheDocument();
  });

  it('should ask before regenerating mid-conversation and say how many messages go', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn(api.regenerateMessage);
    openThread();
    await screen.findByText('First question');

    await user.click(within(assistantMessage(0)).getByRole('button', { name: 'Regenerate' }));

    expect(api.regenerateMessage).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: /confirm regenerate/i });
    expect(confirm).toHaveTextContent('Regenerating removes the 2 later messages.');

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(api.regenerateMessage).not.toHaveBeenCalled();

    await user.click(within(assistantMessage(0)).getByRole('button', { name: 'Regenerate' }));
    await user.click(screen.getByRole('button', { name: 'Regenerate anyway' }));
    await turn.whenStarted();

    expect(turn.messageId).toBe('a1');
    expect(screen.queryByText('Second question')).not.toBeInTheDocument();
    expect(screen.queryByText('Second **bold** answer')).not.toBeInTheDocument();
    expect(screen.getByText('First question')).toBeInTheDocument();
  });

  it('should regenerate with a model chosen in the picker and follow it in the header', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn(api.regenerateMessage);
    openThread();
    await screen.findByText('First question');

    await user.click(within(assistantMessage(1)).getByRole('button', { name: /regenerate with/i }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a model for this answer' });
    const rigRow = within(within(dialog).getAllByRole('group')[2]).getByRole('option', { name: /llama3\.1:8b/ });
    await user.click(rigRow);
    await turn.whenStarted();

    expect(turn.body).toEqual({ target: { model: 'llama3.1:8b', nodeId: NODE_RIG } });
    expect(screen.queryByRole('dialog', { name: /for this answer/i })).not.toBeInTheDocument();

    await turn.emit('meta', { ...META, conversationId: 'c9', nodeId: NODE_RIG, nodeName: 'Rig-2', auto: false });
    expect(screen.getByRole('button', { name: /llama3\.1:8b\s*Rig-2/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('generation-tag').at(-1)).toHaveTextContent('llama3.1:8b · Rig-2');
  });

  it('should edit a user message, resend it and drop what followed', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn(api.editMessage);
    openThread();
    await screen.findByText('First question');

    await user.click(within(userMessage(0)).getByRole('button', { name: 'Edit' }));
    const box = screen.getByRole('textbox', { name: 'Edit message' });
    expect(box).toHaveValue('First question');
    expect(screen.getByText(/removes the 3 later messages/i)).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'First question, reworded');
    await user.click(screen.getByRole('button', { name: /save & send/i }));
    await turn.whenStarted();

    expect(turn.messageId).toBe('u1');
    expect(turn.body).toEqual({ content: 'First question, reworded', target: { model: 'llama3.1:8b', nodeId: null } });
    expect(screen.getByText('First question, reworded')).toBeInTheDocument();
    expect(screen.getByText('edited')).toBeInTheDocument();
    expect(screen.queryByText('First answer')).not.toBeInTheDocument();
    expect(screen.queryByText('Second question')).not.toBeInTheDocument();
  });

  it('should cancel an edit without calling the API', async () => {
    const user = userEvent.setup();
    openThread();
    await screen.findByText('First question');

    await user.click(within(userMessage(0)).getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByRole('textbox', { name: 'Edit message' }), ' more');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.editMessage).not.toHaveBeenCalled();
    expect(screen.getByText('First question')).toBeInTheDocument();
    expect(screen.queryByText('edited')).not.toBeInTheDocument();
  });

  it('should disable the controls while a reply is streaming', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn(api.regenerateMessage);
    openThread();
    await screen.findByText('First question');
    await user.click(within(assistantMessage(1)).getByRole('button', { name: 'Regenerate' }));
    await turn.whenStarted();

    expect(within(assistantMessage(0)).getByRole('button', { name: 'Regenerate' })).toBeDisabled();
    expect(within(assistantMessage(0)).getByRole('button', { name: /regenerate with/i })).toBeDisabled();
    expect(within(userMessage(0)).getByRole('button', { name: 'Edit' })).toBeDisabled();
    // Copying stays available.
    expect(within(userMessage(0)).getByRole('button', { name: 'Copy message' })).toBeEnabled();

    await turn.emit('done', DONE);
    await turn.finish('done', DONE);
    await waitFor(() => expect(within(userMessage(0)).getByRole('button', { name: 'Edit' })).toBeEnabled());
  });

  it('should put the messages back when a regenerate is rejected before it starts', async () => {
    const user = userEvent.setup();
    api.regenerateMessage.mockRejectedValueOnce(Object.assign(new Error('A reply is already being generated.'), { status: 409 }));
    openThread();
    await screen.findByText('First question');

    await user.click(within(assistantMessage(1)).getByRole('button', { name: 'Regenerate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already being generated');
    expect(screen.getByText(/Second.*answer/)).toBeInTheDocument();
  });

  it('should label stopped and interrupted replies and offer Regenerate on both', async () => {
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Q' }),
      makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'half', status: 'cancelled', generation: gen() }),
      makeMessage({
        id: 'a2', seq: 3, role: 'assistant', content: '', status: 'error', generation: gen(),
        error: { code: 'INTERRUPTED', message: 'The reply was interrupted.' },
      }),
    ]);

    expect(await screen.findByText('Stopped')).toBeInTheDocument();
    expect(screen.getByText('Interrupted before any reply')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Regenerate' })).toHaveLength(2);
  });
});

describe('AiChatPage code blocks', () => {
  const CODE = 'Run this:\n\n```js\nconst total = 1 + 2;\nconsole.log("total");\n```\n';

  it('should highlight a fenced block, label its language and copy the raw code', async () => {
    const user = userEvent.setup();
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Show me' }),
      makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: CODE, generation: gen() }),
    ]);

    const block = (await screen.findByText('js')).closest('.ai-chat__code');

    expect(block.querySelector('.hljs-keyword')).toHaveTextContent('const');
    expect(block.querySelector('.hljs-string')).toBeInTheDocument();
    await user.click(within(block).getByRole('button', { name: 'Copy code' }));
    expect(await navigator.clipboard.readText()).toBe('const total = 1 + 2;\nconsole.log("total");\n');
    expect(within(block).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('should label a fence without a language as text and leave inline code alone', async () => {
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Q' }),
      makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'Use `npm test`.\n\n```\nplain\n```\n', generation: gen() }),
    ]);

    const block = (await screen.findByText('text')).closest('.ai-chat__code');

    expect(block.querySelector('.hljs-keyword')).toBeNull();
    expect(screen.getByText('npm test').closest('.ai-chat__code')).toBeNull();
  });

  it('should keep rendering while a fence is still open during streaming', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'code please');
    await turn.whenStarted();
    await turn.emit('meta', META);

    await turn.emit('token', { content: 'Here:\n\n```py\ndef add(a, b):\n    ret' });
    expect(screen.getByText('py')).toBeInTheDocument();
    expect(screen.getByText('def')).toHaveClass('hljs-keyword');

    await turn.emit('token', { content: 'urn a + b\n```\nDone.' });
    await turn.emit('done', DONE);
    await turn.finish('done', DONE);

    expect(await screen.findByText('Done.')).toBeInTheDocument();
    expect(screen.getAllByText('py')).toHaveLength(1);
  });
});

describe('AiChatPage reply stats', () => {
  it('should summarise tokens per second and total time, and show the details on request', async () => {
    const user = userEvent.setup();
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Q' }),
      makeMessage({
        id: 'a1', seq: 2, role: 'assistant', content: 'A',
        generation: gen({
          tokensPerSecond: 48.2, totalMs: 5210, ttftMs: 420, loadMs: 1800, thinkingMs: 2400,
          promptTokens: 812, completionTokens: 240, finishReason: 'stop', presetName: 'Code reviewer',
        }),
      }),
    ]);

    expect(await screen.findByTestId('generation-stats')).toHaveTextContent('48.2 tok/s · 5.2 s');
    await user.click(screen.getByRole('button', { name: 'Details' }));

    const details = screen.getByLabelText('Reply details');
    expect(within(details).getByText('Time to first token').nextSibling).toHaveTextContent('420 ms');
    expect(within(details).getByText('Total time').nextSibling).toHaveTextContent('5.2 s');
    expect(within(details).getByText('Model load').nextSibling).toHaveTextContent('1.8 s');
    expect(within(details).getByText('Thinking').nextSibling).toHaveTextContent('2.4 s');
    expect(within(details).getByText(/Tokens/).nextSibling).toHaveTextContent('812 → 240');
    expect(within(details).getByText('Context length').nextSibling).toHaveTextContent('8,192');
    expect(within(details).getByText('Finish reason').nextSibling).toHaveTextContent('stop');
    expect(within(details).getByText('Preset').nextSibling).toHaveTextContent('Code reviewer');
  });

  it('should omit missing stats instead of showing 0 or NaN', async () => {
    const user = userEvent.setup();
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Q' }),
      makeMessage({
        id: 'a1', seq: 2, role: 'assistant', content: 'A',
        generation: gen({ totalMs: 3000, tokensPerSecond: null, loadMs: 0, thinkingMs: null, ttftMs: undefined, promptTokens: null, completionTokens: NaN }),
      }),
    ]);

    expect(await screen.findByTestId('generation-stats')).toHaveTextContent(/^3\.0 s$/);
    await user.click(screen.getByRole('button', { name: 'Details' }));

    const details = screen.getByLabelText('Reply details');
    expect(within(details).queryByText('Model load')).not.toBeInTheDocument();
    expect(within(details).queryByText('Thinking')).not.toBeInTheDocument();
    expect(within(details).queryByText('Time to first token')).not.toBeInTheDocument();
    expect(within(details).queryByText(/Tokens|tokens/)).not.toBeInTheDocument();
    expect(details.textContent).not.toMatch(/NaN|\b0 ms/);
  });

  it('should show no stats at all when the reply has none', async () => {
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Q' }),
      makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'A', generation: { model: 'llama3.1:8b', nodeName: 'Matt-PC' } }),
    ]);

    await screen.findByTestId('generation-tag');

    expect(screen.queryByTestId('generation-stats')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
  });

  it('should show live stats from the done event', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    await turn.emit('meta', META);
    await turn.emit('token', { content: 'Yo' });

    expect(screen.queryByTestId('generation-stats')).not.toBeInTheDocument();
    await turn.emit('done', DONE);
    await turn.finish('done', DONE);

    expect(await screen.findByTestId('generation-stats')).toHaveTextContent('40.0 tok/s · 2.0 s');
  });
});

const usage = (extra = {}) => ({
  model: 'llama3.1:8b', nodeId: NODE_PC, contextLength: 8192, usedTokens: 3000, totalTokens: 3000,
  fits: true, trimmedCount: 0, summaryActive: false, ...extra,
});

describe('AiChatPage context window', () => {
  it('should feed the ring from the detail, the meta estimate and the done totals', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    openThread(thread(), { context: usage({ usedTokens: 2000 }) });
    await screen.findByText('First question');
    expect(screen.getByRole('img', { name: /Context: 2,000 \/ 8,192 tokens/ })).toBeInTheDocument();

    await typeAndSend(user, 'Another');
    await turn.whenStarted();
    await turn.emit('meta', { ...META, conversationId: 'c9', context: { promptTokensEstimate: 2600, trimmedCount: 0, summaryActive: false } });
    expect(screen.getByRole('img', { name: /Context: 2,600 \/ 8,192 tokens/ })).toBeInTheDocument();

    await turn.emit('done', { ...DONE, promptTokens: 2700, completionTokens: 150 });
    await turn.finish('done', DONE);
    expect(await screen.findByRole('img', { name: /Context: 2,850 \/ 8,192 tokens/ })).toBeInTheDocument();
  });

  it('should warn about trimmed messages from the detail and summarise them on request', async () => {
    const user = userEvent.setup();
    let finish;
    api.summarizeConversation.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    openThread(thread(), { context: usage({ trimmedCount: 3, fits: false, usedTokens: 6000 }) });

    const banner = await screen.findByText("3 older messages don't fit llama3.1:8b's context window and won't be sent.");
    expect(banner).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Summarise older turns' }));
    expect(api.summarizeConversation).toHaveBeenCalledWith('jwt', 'c9');
    expect(screen.getByRole('button', { name: /summarising/i })).toBeDisabled();

    await act(async () =>
      finish({
        conversation: makeConversation({ id: 'c9' }),
        summary: { text: 'Earlier talk', coversThroughSeq: 2 },
        context: usage({ usedTokens: 1500, summaryActive: true }),
      })
    );

    await waitFor(() => expect(screen.queryByText(/older messages don't fit/)).not.toBeInTheDocument());
    expect(screen.getByText('Older turns are summarised for this model')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Context: 1,500 \/ 8,192 tokens/ })).toBeInTheDocument();
  });

  it('should let the warning be dismissed, and speak of a single message in the singular', async () => {
    const user = userEvent.setup();
    openThread(thread(), { context: usage({ trimmedCount: 1, fits: false }) });

    expect(await screen.findByText("1 older message doesn't fit llama3.1:8b's context window and won't be sent.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss warning' }));

    expect(screen.queryByText(/older message/)).not.toBeInTheDocument();
  });

  it('should show the warning as soon as meta reports trimming', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    openThread();
    await screen.findByText('First question');
    expect(screen.queryByText(/older messages/)).not.toBeInTheDocument();

    await typeAndSend(user, 'One more');
    await turn.whenStarted();
    await turn.emit('meta', { ...META, conversationId: 'c9', context: { promptTokensEstimate: 6000, trimmedCount: 2, summaryActive: false } });

    expect(screen.getByText("2 older messages don't fit llama3.1:8b's context window and won't be sent.")).toBeInTheDocument();
  });

  it('should warn from a preflight when the selection changes to a smaller window', async () => {
    const user = userEvent.setup();
    api.getContextUsage.mockResolvedValue(usage({ model: 'qwen3:14b', contextLength: 4096, usedTokens: 3000, trimmedCount: 4, fits: false }));
    openThread();
    await screen.findByText('First question');

    await user.click(screen.getByRole('button', { name: /llama3\.1:8b/ }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('option', { name: /qwen3:14b/ })[0]);

    expect(await screen.findByText("4 older messages don't fit qwen3:14b's context window and won't be sent.")).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Context: 3,000 \/ 4,096 tokens/ })).toBeInTheDocument();
  });

  it('should clear the warning when the preflight cannot resolve the new target', async () => {
    const user = userEvent.setup();
    api.getContextUsage.mockRejectedValue(Object.assign(new Error('No node'), { status: 503 }));
    openThread(thread(), { context: usage({ trimmedCount: 2, fits: false }) });
    await screen.findByText(/2 older messages/);

    await user.click(screen.getByRole('button', { name: /llama3\.1:8b/ }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('option', { name: /qwen3:14b/ })[0]);

    await waitFor(() => expect(screen.queryByText(/older messages/)).not.toBeInTheDocument());
  });

  it('should surface a failed summarise and keep the warning', async () => {
    const user = userEvent.setup();
    api.summarizeConversation.mockRejectedValue(new Error('No node available'));
    openThread(thread(), { context: usage({ trimmedCount: 3, fits: false }) });

    await user.click(await screen.findByRole('button', { name: 'Summarise older turns' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No node available');
    expect(screen.getByText(/3 older messages/)).toBeInTheDocument();
  });

  it('should flag a reply that filled the model window', async () => {
    const user = userEvent.setup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Big prompt');
    await turn.whenStarted();
    await turn.emit('meta', META);
    await turn.emit('token', { content: 'ok' });
    await turn.emit('done', { ...DONE, contextOverflow: true });
    await turn.finish('done', DONE);

    expect(await screen.findByText(/window was full; early context may have been cut/i)).toBeInTheDocument();
  });

  it('should explain CONTEXT_TOO_SMALL and suggest a larger window', async () => {
    const user = userEvent.setup();
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Huge' }),
      makeMessage({
        id: 'a1', seq: 2, role: 'assistant', content: '', status: 'error', generation: gen(),
        error: { code: 'CONTEXT_TOO_SMALL', message: 'The newest message does not fit.' },
      }),
    ]);

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('The newest message does not fit.');
    expect(alert).toHaveTextContent(/larger window/i);
    expect(alert).toHaveTextContent('CONTEXT_TOO_SMALL');
    await user.click(within(alert).getByRole('button', { name: 'Choose a model' }));
    expect(screen.getByRole('dialog', { name: 'Choose a model' })).toBeInTheDocument();
  });
});

describe('AiChatPage failover', () => {
  const NODE_OFFLINE_ERROR = {
    messageId: 'a1', userMessageId: 'u1', code: 'NODE_OFFLINE', message: 'Matt-PC is offline.', retryable: true,
    alternatives: [{ nodeId: NODE_RIG, nodeName: 'Rig-2', model: 'llama3.1:8b', loaded: true, status: 'ONLINE' }],
  };

  async function failFirstTurn(user, error = NODE_OFFLINE_ERROR) {
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hello');
    await turn.whenStarted();
    await turn.emit('meta', META);
    await turn.emit('error', error);
    await turn.finish('error', error);
    return turn;
  }

  it('should offer each alternative and Auto after an error, and regenerate with the chosen target', async () => {
    const user = userEvent.setup();
    await failFirstTurn(user);
    const retry = scriptTurn(api.regenerateMessage);

    const choices = await screen.findByRole('group', { name: /other ways/i });
    const rig = within(choices).getByRole('button', { name: /Use llama3\.1:8b on Rig-2/ });
    expect(within(rig).getByText('Loaded')).toBeInTheDocument();
    await user.click(rig);
    await retry.whenStarted();

    expect(retry.conversationId).toBe('c-new');
    expect(retry.messageId).toBe('a1');
    expect(retry.body).toEqual({ target: { model: 'llama3.1:8b', nodeId: NODE_RIG } });
    // The failed reply is replaced by the new, streaming one.
    expect(screen.queryByText('Matt-PC is offline.')).not.toBeInTheDocument();
  });

  it('should regenerate on Auto from Switch to Auto', async () => {
    const user = userEvent.setup();
    await failFirstTurn(user);
    const retry = scriptTurn(api.regenerateMessage);

    await user.click(await screen.findByRole('button', { name: 'Switch to Auto' }));
    await retry.whenStarted();

    expect(retry.body).toEqual({ target: { model: 'llama3.1:8b', nodeId: null } });
  });

  it('should say so when the error carries no alternatives and offer the picker', async () => {
    const user = userEvent.setup();
    await failFirstTurn(user, { ...NODE_OFFLINE_ERROR, alternatives: [] });

    expect(await screen.findByText('No other node has llama3.1:8b right now.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose another model' }));

    expect(screen.getByRole('dialog', { name: 'Choose a model' })).toBeInTheDocument();
  });

  it('should derive the alternatives from the catalogue for a stored error after a reload', async () => {
    const user = userEvent.setup();
    const retry = scriptTurn(api.regenerateMessage);
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Hello' }),
      makeMessage({
        id: 'a1', seq: 2, role: 'assistant', content: '', status: 'error',
        generation: gen({ nodeId: 'node-garage', nodeName: 'Garage-Laptop' }),
        error: { code: 'NODE_UNREACHABLE', message: 'Garage-Laptop went away.' },
      }),
    ]);

    const choices = await screen.findByRole('group', { name: /other ways/i });
    const buttons = within(choices).getAllByRole('button').map((b) => b.textContent);

    // Not offline, has the model, warm first; the offline Garage-Laptop is never offered.
    expect(buttons).toEqual([
      'Use llama3.1:8b on Matt-PCLoaded',
      'Use llama3.1:8b on Rig-2',
      'Switch to Auto',
    ]);
    await user.click(within(choices).getByRole('button', { name: /on Rig-2/ }));
    await retry.whenStarted();
    expect(retry.body).toEqual({ target: { model: 'llama3.1:8b', nodeId: NODE_RIG } });
  });

  it('should say so when no online node has the failed model after a reload', async () => {
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Hello' }),
      makeMessage({
        id: 'a1', seq: 2, role: 'assistant', content: '', status: 'error',
        generation: gen({ model: 'phi3:mini', nodeId: 'node-garage', nodeName: 'Garage-Laptop' }),
        error: { code: 'NODE_OFFLINE', message: 'Garage-Laptop is offline.' },
      }),
    ]);

    expect(await screen.findByText('No other node has phi3:mini right now.')).toBeInTheDocument();
  });

  it('should not offer failover for errors that are not about the node', async () => {
    openThread([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Hello' }),
      makeMessage({
        id: 'a1', seq: 2, role: 'assistant', content: '', status: 'error', generation: gen(),
        error: { code: 'TIMEOUT', message: 'The node stopped answering.' },
      }),
    ]);

    await screen.findByText('The node stopped answering.');

    expect(screen.queryByRole('group', { name: /other ways/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument();
  });

  it('should show a proactive banner when the selection pins an offline node, with one-click choices', async () => {
    const user = userEvent.setup();
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c9', target: { model: 'llama3.1:8b', nodeId: 'node-garage' } }),
      context: null,
      messages: thread(),
    });
    renderPage('/ai?c=c9');

    const banner = (await screen.findByText('Garage-Laptop is offline.')).closest('.ai-chat__banner');
    // The stored target is kept (no silent fallback to Auto) and sending is not blocked.
    expect(screen.getByRole('button', { name: /llama3\.1:8b\s*Garage-Laptop/ })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'still send');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();

    await user.click(within(banner).getByRole('button', { name: /Use llama3\.1:8b on Rig-2/ }));

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { target: { model: 'llama3.1:8b', nodeId: NODE_RIG } })
    );
    expect(screen.getByRole('button', { name: /llama3\.1:8b\s*Rig-2/ })).toBeInTheDocument();
    expect(screen.queryByText('Garage-Laptop is offline.')).not.toBeInTheDocument();
  });

  it('should switch the selection to Auto from the offline banner', async () => {
    const user = userEvent.setup();
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c9', target: { model: 'llama3.1:8b', nodeId: 'node-garage' } }),
      context: null,
      messages: thread(),
    });
    renderPage('/ai?c=c9');

    await user.click(await screen.findByRole('button', { name: 'Switch to Auto' }));

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { target: { model: 'llama3.1:8b', nodeId: null } })
    );
    expect(screen.queryByText('Garage-Laptop is offline.')).not.toBeInTheDocument();
  });

  it('should not show the offline banner when the pinned node is reachable', async () => {
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c9', target: { model: 'llama3.1:8b', nodeId: NODE_PC } }),
      context: null,
      messages: thread(),
    });
    renderPage('/ai?c=c9');
    await screen.findByText('First question');

    expect(screen.queryByText(/is offline/)).not.toBeInTheDocument();
  });
});
