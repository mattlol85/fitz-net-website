import React from 'react';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DONE, META, makeMessage, openConversation, renderPage, scriptTurn, setupApiDefaults, typeAndSend,
  userEventSetup, waitForReady,
} from './aiPageTestUtils';
import { NODE_PC } from './aiTestData';
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
}));

const gen = (extra = {}) => ({ nodeId: NODE_PC, nodeName: 'Matt-PC', model: 'llama3.1:8b', auto: false, ...extra });
const announcement = () => screen.getByTestId('turn-announcement');

beforeEach(() => setupApiDefaults());

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  [api.sendMessage, api.regenerateMessage, api.editMessage].forEach((fn) => fn.mockReset());
});

describe('stored context warnings', () => {
  it('should keep the window-full warning on a reply after a reload', async () => {
    openConversation([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Big' }),
      makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'Done', generation: gen({ contextOverflow: true }) }),
    ]);

    expect(await screen.findByText(/window was full; early context may have been cut/i)).toBeInTheDocument();
  });

  it('should not warn when the stored flag is false or absent', async () => {
    openConversation([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Small' }),
      makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'Fine', generation: gen({ contextOverflow: false }) }),
    ]);

    await screen.findByText('Fine');

    expect(screen.queryByText(/window was full/i)).not.toBeInTheDocument();
  });

  it('should say when only the most recent part of the older turns could be summarised', async () => {
    openConversation([makeMessage({ id: 'u1', content: 'Hi' })], {}, {
      summary: { text: 'Earlier', coversThroughSeq: 3, partial: true },
      context: { model: 'llama3.1:8b', contextLength: 8192, usedTokens: 100, trimmedCount: 0, summaryActive: true },
    });

    const note = await screen.findByText(/Older turns are summarised for this model/);

    expect(note).toHaveTextContent('Only the most recent part of the older turns could be summarised.');
  });

  it('should keep the plain summary note when the summary is complete', async () => {
    openConversation([makeMessage({ id: 'u1', content: 'Hi' })], {}, {
      summary: { text: 'Earlier', coversThroughSeq: 3, partial: false },
      context: { model: 'llama3.1:8b', contextLength: 8192, usedTokens: 100, trimmedCount: 0, summaryActive: true },
    });

    const note = await screen.findByText('Older turns are summarised for this model');

    expect(note).not.toHaveTextContent('Only the most recent');
  });
});

describe('offline banner and failover choices', () => {
  const offlineTarget = { model: 'llama3.1:8b', nodeId: 'node-garage' };

  it('should hide the proactive banner while the last reply already shows failover choices', async () => {
    openConversation(
      [
        makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Hello' }),
        makeMessage({
          id: 'a1', seq: 2, role: 'assistant', content: '', status: 'error', generation: gen({ nodeId: 'node-garage' }),
          error: { code: 'NODE_OFFLINE', message: 'Garage-Laptop is offline.' },
        }),
      ],
      { target: offlineTarget }
    );

    await screen.findByRole('group', { name: /other ways/i });

    expect(screen.getAllByRole('button', { name: 'Switch to Auto' })).toHaveLength(1);
    expect(screen.queryByText('Garage-Laptop is offline.', { selector: '.ai-chat__banner-text' })).not.toBeInTheDocument();
  });

  it('should show the banner when the last reply is not a failover error', async () => {
    openConversation(
      [
        makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Hello' }),
        makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'Hi', generation: gen() }),
      ],
      { target: offlineTarget }
    );

    expect(await screen.findByText('Garage-Laptop is offline.')).toBeInTheDocument();
  });

  it('should show the banner again once a later turn replaces the failed reply', async () => {
    openConversation(
      [
        makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Hello' }),
        makeMessage({
          id: 'a1', seq: 2, role: 'assistant', content: '', status: 'error', generation: gen({ nodeId: 'node-garage' }),
          error: { code: 'TIMEOUT', message: 'The node stopped answering.' },
        }),
      ],
      { target: offlineTarget }
    );

    // A timeout is not a failover error, so nothing else offers the choices.
    expect(await screen.findByText('Garage-Laptop is offline.')).toBeInTheDocument();
  });
});

describe('live announcements', () => {
  it('should announce the loading phase, generation and the finished reply, but not every token', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    expect(announcement()).toHaveAttribute('aria-live', 'polite');
    expect(announcement()).toBeEmptyDOMElement();

    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    expect(announcement()).toHaveTextContent('Waiting for the model');

    await turn.emit('meta', META);
    await turn.emit('status', { phase: 'loading_model', model: 'llama3.1:8b', message: 'Loading…' });
    expect(announcement()).toHaveTextContent('Loading llama3.1:8b on Matt-PC…');

    await turn.emit('status', { phase: 'generating' });
    await turn.emit('token', { content: 'Hel' });
    expect(announcement()).toHaveTextContent('Generating');
    await turn.emit('token', { content: 'lo' });
    expect(announcement()).toHaveTextContent(/^Generating$/);

    await turn.emit('done', DONE);
    await turn.finish('done', DONE);
    expect(await screen.findByText('Reply finished', { selector: '[aria-live]' })).toBeInTheDocument();
  });

  it('should announce an error and a stopped reply', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();
    await turn.emit('meta', META);
    const error = { messageId: 'a1', userMessageId: 'u1', code: 'NODE_ERROR', message: 'Ollama returned an error.', alternatives: [] };
    await turn.emit('error', error);
    await turn.finish('error', error);

    expect(await screen.findByText('Error: Ollama returned an error.', { selector: '[aria-live]' })).toBeInTheDocument();
  });

  it('should announce nothing when a conversation is opened', async () => {
    openConversation([
      makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Hi' }),
      makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'Hello', generation: gen() }),
    ]);

    await screen.findByText('Hello');

    expect(announcement()).toBeEmptyDOMElement();
  });
});

describe('dialog behaviour of the model picker', () => {
  it('should keep Tab inside the picker, close it on Escape and return focus to its button', async () => {
    const user = userEventSetup();
    renderPage();
    await waitForReady();
    const opener = screen.getByRole('button', { name: /llama3\.1:8b/ });

    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Choose a model' });
    expect(within(dialog).getByRole('combobox')).toHaveFocus();

    within(dialog).getByRole('button', { name: 'Refresh models' }).focus();
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Refresh models' }), { key: 'Tab' });
    expect(within(dialog).getByRole('combobox')).toHaveFocus();

    fireEvent.keyDown(within(dialog).getByRole('combobox'), { key: 'Tab', shiftKey: true });
    expect(within(dialog).getByRole('button', { name: 'Refresh models' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
