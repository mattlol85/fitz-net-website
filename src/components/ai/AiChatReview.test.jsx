import React from 'react';
import { act, cleanup, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DONE, META, makeMessage, openConversation, renderPage, scriptTurn, setupApiDefaults, typeAndSend,
  userEventSetup, waitForReady,
} from './aiPageTestUtils';
import { makeCatalogue, makeConversation, NODE_PC } from './aiTestData';
import useAiChat from '../../hooks/useAiChat';
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
  listPresets: vi.fn(),
  fetchAttachment: vi.fn(),
}));

const gen = { nodeId: NODE_PC, nodeName: 'Matt-PC', model: 'llama3.1:8b', auto: false };

beforeEach(() => {
  setupApiDefaults();
  api.fetchAttachment.mockResolvedValue(new Blob(['b'], { type: 'image/jpeg' }));
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  [api.sendMessage, api.regenerateMessage, api.editMessage].forEach((fn) => fn.mockReset());
});

describe('ids of a turn that fails or stops early', () => {
  it('should take the user message id from an error that arrives before meta, so Edit works', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hello');
    await turn.whenStarted();
    const error = {
      messageId: 'a-real', userMessageId: 'u-real', code: 'NO_NODE_AVAILABLE', message: 'No node can serve it.', alternatives: [],
    };
    await turn.emit('error', error);
    await turn.finish('error', error);
    const edit = scriptTurn(api.editMessage);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.type(screen.getByRole('textbox', { name: 'Edit message' }), '!');
    await user.click(screen.getByRole('button', { name: /save & send/i }));
    await edit.whenStarted();

    expect(edit.messageId).toBe('u-real');
  });

  it('should reload the conversation when a turn is stopped before meta, replacing the local ids', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hello');
    await turn.whenStarted();
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c-new' }),
      context: null,
      messages: [
        makeMessage({ id: 'u-real', seq: 1, role: 'user', content: 'Hello' }),
        makeMessage({ id: 'a-real', seq: 2, role: 'assistant', content: 'partial words', status: 'cancelled', generation: gen }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(await screen.findByText('partial words', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(api.getConversation).toHaveBeenCalledWith('jwt', 'c-new');
    const edit = scriptTurn(api.editMessage);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByRole('textbox', { name: 'Edit message' }), '?');
    await user.click(screen.getByRole('button', { name: /save & send/i }));
    await edit.whenStarted();
    expect(edit.messageId).toBe('u-real');
  });

  it('should not reload when meta already gave the real ids', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hello');
    await turn.whenStarted();
    await turn.emit('meta', META);

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await screen.findByText('Stopped before any reply');
    await new Promise((r) => setTimeout(r, 700));

    expect(api.getConversation).not.toHaveBeenCalled();
  });

  it('should give the text back when Stop lands while the conversation is still being created', async () => {
    const user = userEventSetup();
    api.createConversation.mockImplementation(
      (token, body, { signal }) =>
        new Promise((resolve, reject) =>
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        )
    );
    renderPage();
    await waitForReady();

    await typeAndSend(user, 'Draft that must survive');
    await user.click(await screen.findByRole('button', { name: 'Stop' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Draft that must survive'));
    expect(within(screen.queryByTestId('ai-chat-messages') || document.body).queryByText('Draft that must survive', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Matt-GPT')).not.toBeInTheDocument();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});

describe('editing', () => {
  const imageOnly = () =>
    makeMessage({
      id: 'u1', seq: 1, role: 'user', content: '',
      attachments: [{ id: 'att-a', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 1, name: 'bell.jpg' }],
    });

  it('should let an image-only message be edited to empty text', async () => {
    const user = userEventSetup();
    const turn = scriptTurn(api.editMessage);
    openConversation([imageOnly()]);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Edit message' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /save & send/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /save & send/i }));
    await turn.whenStarted();

    expect(turn.body.content).toBe('');
  });

  it('should disable Save with a reason when a text-only message is emptied', async () => {
    const user = userEventSetup();
    openConversation([makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Some text' })]);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByRole('textbox', { name: 'Edit message' }));

    expect(screen.getByRole('button', { name: /save & send/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('A message needs some text.');
    await user.type(screen.getByRole('textbox', { name: 'Edit message' }), 'x');
    expect(screen.getByRole('button', { name: /save & send/i })).toBeEnabled();
  });
});

describe('regenerate and edit with an id that is not in the list', () => {
  const setup = async () => {
    api.getConversation.mockResolvedValue({
      ...makeConversation({ id: 'c9' }),
      context: null,
      messages: [
        makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Q' }),
        makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'A', generation: gen }),
      ],
    });
    const hook = renderHook(() =>
      useAiChat({
        token: 'jwt', conversationId: 'c9', catalogue: makeCatalogue(), setConversationId: vi.fn(),
      })
    );
    await waitFor(() => expect(hook.result.current.messages).toHaveLength(2));
    api.getConversation.mockClear();
    return hook;
  };

  it('should reload instead of sending a regenerate for an unknown message', async () => {
    const { result } = await setup();

    await act(async () => result.current.regenerate('missing'));

    expect(api.regenerateMessage).not.toHaveBeenCalled();
    expect(api.getConversation).toHaveBeenCalledWith('jwt', 'c9');
  });

  it('should reload instead of sending an edit for an unknown message', async () => {
    const { result } = await setup();

    await act(async () => result.current.edit('missing', 'text'));

    expect(api.editMessage).not.toHaveBeenCalled();
    expect(api.getConversation).toHaveBeenCalledWith('jwt', 'c9');
  });
});

describe('batched streaming updates', () => {
  it('should apply a burst of deltas in one animation frame without losing any', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    await turn.emit('meta', META);
    const frames = vi.spyOn(window, 'requestAnimationFrame');

    await turn.emitBatch([
      ['thinking', { content: 'a' }],
      ['thinking', { content: 'b' }],
      ['token', { content: 'one ' }],
      ['token', { content: 'two ' }],
      ['token', { content: 'three' }],
    ]);

    expect(frames).toHaveBeenCalledTimes(1);
    expect(screen.getByText('one two three')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /thinking/i }));
    expect(screen.getByRole('region', { name: /reasoning/i })).toHaveTextContent('ab');
  });

  it('should flush buffered deltas before done, so the last tokens are never dropped', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    await turn.emit('meta', META);

    await turn.emitBatch([['token', { content: 'The end.' }], ['done', DONE]], { wait: false });
    await turn.finish('done', DONE);

    expect(screen.getByText('The end.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('should keep the partial text when the reply is stopped with deltas still buffered', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    await turn.emit('meta', META);

    await turn.emitBatch([['token', { content: 'Half a thought' }]], { wait: false });
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(await screen.findByText('Half a thought')).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });
});
