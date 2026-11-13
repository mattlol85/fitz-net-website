import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect } from 'vitest';
import AiChatPage from './AiChatPage';
import { makeCatalogue, makeConversation, makeMessage, NODE_PC } from './aiTestData';
import * as api from '../../services/aiChatApi';
import { useAuth } from '../../contexts/AuthContext';

/** Shared harness for the AiChatPage tests. The test file must vi.mock the API module itself. */
export const LLAMA_AUTO = { model: 'llama3.1:8b', nodeId: null };

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
}

export function renderPage(url = '/ai') {
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

/** Scripts the next call of a streaming API mock; the test pushes events and finishes by hand. */
export function scriptTurn(mock = api.sendMessage) {
  const turn = {};
  mock.mockImplementationOnce(
    (...args) =>
      new Promise((resolve, reject) => {
        const { signal, onEvent } = args.at(-1);
        turn.conversationId = args[1];
        turn.messageId = args.length === 5 ? args[2] : undefined;
        turn.body = args.at(-2);
        turn.signal = signal;
        // thinking/token deltas are applied once per animation frame, so let a frame pass.
        turn.emit = (name, data) =>
          act(async () => {
            onEvent(name, data);
            if (name === 'token' || name === 'thinking') await new Promise((r) => setTimeout(r, 30));
          });
        turn.emitBatch = (events, { wait = true } = {}) =>
          act(async () => {
            events.forEach(([name, data]) => onEvent(name, data));
            if (wait) await new Promise((r) => setTimeout(r, 30));
          });
        turn.finish = (event, data) => act(async () => resolve({ event, data }));
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        turn.started = true;
      })
  );
  turn.whenStarted = () => waitFor(() => expect(turn.started).toBe(true));
  return turn;
}

export const META = {
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

export const DONE = {
  messageId: 'a1',
  userMessageId: 'u1',
  promptTokens: 400,
  completionTokens: 100,
  contextLength: 8192,
  finishReason: 'stop',
  contextOverflow: false,
  stats: { ttftMs: 300, totalMs: 2000, loadMs: 0, thinkingMs: null, tokensPerSecond: 40 },
};

export const typeAndSend = async (user, text) => {
  await user.type(screen.getByRole('textbox', { name: 'Message' }), text);
  await user.keyboard('{Enter}');
};

export const waitForReady = () =>
  waitFor(() =>
    expect(screen.getByRole('button', { name: /llama3\.1:8b|llama3\.2-vision|qwen3|select a model/i })).toBeInTheDocument()
  );

/** Default responses for every mocked endpoint the page touches. */
export function setupApiDefaults({ admin = false } = {}) {
  useAuth.mockReturnValue({ token: 'jwt', hasPermission: () => admin });
  api.listModels.mockResolvedValue(makeCatalogue());
  api.getPreferences.mockResolvedValue({ lastTarget: LLAMA_AUTO, lastPresetId: null });
  api.updatePreferences.mockImplementation(async (token, prefs) => ({ ...prefs }));
  api.warmUp.mockResolvedValue({ state: 'loaded' });
  api.listConversations.mockResolvedValue({ items: [], hasMore: false });
  api.createConversation.mockImplementation(async (token, body) =>
    makeConversation({ id: 'c-new', title: 'New chat', titleSource: 'default', messageCount: 0, ...body })
  );
  api.generateTitle.mockResolvedValue(makeConversation({ id: 'c-new', title: 'Chat', titleSource: 'auto' }));
  api.updateConversation.mockImplementation(async (token, id, patch) => makeConversation({ id, ...patch }));
  api.getContextUsage.mockResolvedValue({ model: 'qwen3:14b', nodeId: NODE_PC, contextLength: 16384, usedTokens: 2048 });
  api.listPresets.mockResolvedValue({ items: [] });
}

export function openConversation(messages = [], overrides = {}, detail = {}) {
  api.getConversation.mockResolvedValue({
    ...makeConversation({ id: 'c9', ...overrides }),
    summary: null,
    context: null,
    messages,
    ...detail,
  });
  return renderPage('/ai?c=c9');
}

export const userEventSetup = () => userEvent.setup();
export { makeMessage };
