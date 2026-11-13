import React from 'react';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeMessage, openConversation, renderPage, scriptTurn, setupApiDefaults, typeAndSend, userEventSetup,
  waitForReady,
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
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
  deletePreset: vi.fn(),
}));

const PRESETS = [
  {
    id: 'p-house', name: 'House style', description: 'Shared by the admin', model: null, nodeId: null,
    systemPrompt: 'Answer in British English.', visibility: 'shared', ownerUsername: 'changmin', editable: false,
  },
  {
    id: 'p-review', name: 'Code reviewer', description: 'Blunt, cites line numbers', model: 'qwen3:14b', nodeId: null,
    systemPrompt: 'You are a strict code reviewer.', visibility: 'private', ownerUsername: 'testuser', editable: true,
  },
  {
    id: 'p-quick', name: 'Quick answers', description: 'Short and fast', model: 'llama3.1:8b', nodeId: NODE_PC,
    systemPrompt: null, visibility: 'private', ownerUsername: 'testuser', editable: true,
  },
];

const thread = () => [
  makeMessage({ id: 'u1', seq: 1, role: 'user', content: 'Hello there' }),
  makeMessage({
    id: 'a1', seq: 2, role: 'assistant', content: 'Hi!',
    generation: { nodeId: NODE_PC, nodeName: 'Matt-PC', model: 'llama3.1:8b', auto: true, presetName: 'Code reviewer' },
  }),
];

const openSettings = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Chat settings' }));
  return screen.getByRole('dialog', { name: 'Chat settings' });
};

beforeEach(() => {
  setupApiDefaults();
  api.listPresets.mockResolvedValue({ items: PRESETS });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  [api.sendMessage, api.regenerateMessage, api.editMessage].forEach((fn) => fn.mockReset());
});

describe('chat settings on an existing conversation', () => {
  it('should apply a preset without sending a target and follow the model the server pinned', async () => {
    const user = userEventSetup();
    api.updateConversation.mockImplementation(async (token, id, patch) => ({
      id, title: 'T', settings: patch.settings, target: { model: 'qwen3:14b', nodeId: null },
    }));
    openConversation(thread());
    await screen.findByText('Hello there');

    const dialog = await openSettings(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Preset' }), 'p-review');

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { settings: { presetId: 'p-review', systemPrompt: null } })
    );
    expect(api.updateConversation.mock.calls[0][2]).not.toHaveProperty('target');
    expect(await screen.findByRole('button', { name: /qwen3:14b\s*Auto/ })).toBeInTheDocument();
    // The model the preset pinned gets warmed up.
    await waitFor(() => expect(api.warmUp).toHaveBeenCalledWith('jwt', { model: 'qwen3:14b', nodeId: null }));
  });

  it('should show the active preset as a chip that reopens the settings, and clear it with None', async () => {
    const user = userEventSetup();
    openConversation(thread(), { settings: { presetId: 'p-review', systemPrompt: null } });
    await screen.findByText('Hello there');

    await user.click(await screen.findByRole('button', { name: 'Code reviewer' }));
    const dialog = screen.getByRole('dialog', { name: 'Chat settings' });
    expect(within(dialog).getByRole('combobox', { name: 'Preset' })).toHaveValue('p-review');

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Preset' }), '');

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { settings: { presetId: null, systemPrompt: null } })
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Code reviewer' })).not.toBeInTheDocument());
  });

  it('should keep the system prompt override when the preset changes', async () => {
    const user = userEventSetup();
    openConversation(thread(), { settings: { presetId: null, systemPrompt: 'Be terse.' } });
    await screen.findByText('Hello there');

    const dialog = await openSettings(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Preset' }), 'p-house');

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { settings: { presetId: 'p-house', systemPrompt: 'Be terse.' } })
    );
  });

  it('should save and clear the per-chat system prompt, with a counter and a marker', async () => {
    const user = userEventSetup();
    openConversation(thread());
    await screen.findByText('Hello there');
    expect(screen.queryByRole('button', { name: 'Custom prompt' })).not.toBeInTheDocument();

    const dialog = await openSettings(user);
    const box = within(dialog).getByRole('textbox', { name: 'System prompt for this chat' });
    expect(within(dialog).getByText('0 / 8000')).toBeInTheDocument();
    await user.type(box, 'Answer like a pirate');
    expect(within(dialog).getByText('20 / 8000')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { settings: { presetId: null, systemPrompt: 'Answer like a pirate' } })
    );
    expect(await screen.findByRole('button', { name: 'Custom prompt' })).toBeInTheDocument();

    await user.click(within(screen.getByRole('dialog', { name: 'Chat settings' })).getByRole('button', { name: 'Clear' }));

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenLastCalledWith('jwt', 'c9', { settings: { presetId: null, systemPrompt: null } })
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Custom prompt' })).not.toBeInTheDocument());
  });

  it('should refuse a system prompt over 8000 characters', async () => {
    const user = userEventSetup();
    openConversation(thread());
    await screen.findByText('Hello there');
    const dialog = await openSettings(user);

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'System prompt for this chat' }), {
      target: { value: 'x'.repeat(8001) },
    });

    expect(within(dialog).getByText('8001 / 8000')).toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('at most 8000');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('should show the preset prompt read-only when there is no override', async () => {
    const user = userEventSetup();
    openConversation(thread(), { settings: { presetId: 'p-review', systemPrompt: null } });
    await screen.findByText('Hello there');

    const dialog = await openSettings(user);

    expect(within(dialog).getByText('Applied from the preset:')).toBeInTheDocument();
    expect(within(dialog).getByText('You are a strict code reviewer.')).toBeInTheDocument();
  });

  it('should surface a failed settings save', async () => {
    const user = userEventSetup();
    api.updateConversation.mockRejectedValue(new Error('Preset not found'));
    openConversation(thread());
    await screen.findByText('Hello there');

    const dialog = await openSettings(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Preset' }), 'p-house');

    expect(await screen.findByText('Preset not found')).toBeInTheDocument();
  });

  it('should add the preset name to the message tag', async () => {
    openConversation(thread());

    const tag = await screen.findByTestId('generation-tag');

    expect(tag).toHaveTextContent('Code reviewer');
  });
});

describe('chat settings on a new chat', () => {
  it('should not start with the preference preset', async () => {
    api.getPreferences.mockResolvedValue({ lastTarget: { model: 'llama3.1:8b', nodeId: null }, lastPresetId: 'p-review' });
    renderPage();
    await waitForReady();

    expect(screen.queryByRole('button', { name: 'Code reviewer' })).not.toBeInTheDocument();
  });

  it('should hold the preset locally, select its model and pass the settings to createConversation', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();

    const dialog = await openSettings(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Preset' }), 'p-quick');

    // Pinned to Matt-PC: the selection follows, and nothing is created or patched yet.
    expect(await screen.findByRole('button', { name: /llama3\.1:8b\s*Matt-PC/ })).toBeInTheDocument();
    expect(api.createConversation).not.toHaveBeenCalled();
    expect(api.updateConversation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Quick answers' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();

    expect(api.createConversation).toHaveBeenCalledWith(
      'jwt',
      { target: { model: 'llama3.1:8b', nodeId: NODE_PC }, settings: { presetId: 'p-quick', systemPrompt: null } },
      expect.anything()
    );
  });

  it('should select Auto when the preset pins a model without a node', async () => {
    const user = userEventSetup();
    renderPage();
    await waitForReady();

    const dialog = await openSettings(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Preset' }), 'p-review');

    expect(await screen.findByRole('button', { name: /qwen3:14b\s*Auto/ })).toBeInTheDocument();
  });

  it('should leave the selection alone for a preset that pins no model', async () => {
    const user = userEventSetup();
    renderPage();
    await waitForReady();

    const dialog = await openSettings(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Preset' }), 'p-house');

    expect(await screen.findByRole('button', { name: 'House style' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /llama3\.1:8b\s*Auto/ })).toBeInTheDocument();
  });

  it('should hold a system prompt override for the first message', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();

    const dialog = await openSettings(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'System prompt for this chat' }), 'Be brief');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Custom prompt' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await typeAndSend(user, 'Hi');
    await turn.whenStarted();

    expect(api.createConversation.mock.calls[0][1].settings).toEqual({ presetId: null, systemPrompt: 'Be brief' });
  });

  it('should reset the draft settings on New chat', async () => {
    const user = userEventSetup();
    renderPage();
    await waitForReady();
    const dialog = await openSettings(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Preset' }), 'p-house');
    expect(await screen.findByRole('button', { name: 'House style' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /^new chat$/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'House style' })).not.toBeInTheDocument());
  });
});

describe('presets in the model picker', () => {
  it('should list presets that pin a model in a Presets group at the top and apply one on selection', async () => {
    const user = userEventSetup();
    api.updateConversation.mockImplementation(async (token, id, patch) => ({
      id, title: 'T', settings: patch.settings, target: { model: 'qwen3:14b', nodeId: null },
    }));
    openConversation(thread());
    await screen.findByText('Hello there');

    await user.click(screen.getByRole('button', { name: /llama3\.1:8b/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a model' });
    const groups = within(dialog).getAllByRole('group');
    expect(within(groups[0]).getByText('Presets')).toBeInTheDocument();
    const rows = within(groups[0]).getAllByRole('option');
    expect(rows.map((r) => r.querySelector('.ai-chat__option-name').textContent)).toEqual(['Code reviewer', 'Quick answers']);
    expect(within(rows[0]).getByText('Blunt, cites line numbers')).toBeInTheDocument();
    expect(within(rows[0]).getByText('qwen3:14b')).toBeInTheDocument();
    expect(within(rows[1]).getByText('llama3.1:8b · Matt-PC')).toBeInTheDocument();
    expect(within(dialog).queryByText('House style')).not.toBeInTheDocument();

    await user.click(rows[0]);

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { settings: { presetId: 'p-review', systemPrompt: null } })
    );
    expect(await screen.findByRole('button', { name: 'Code reviewer' })).toBeInTheDocument();
  });

  it('should mark the active preset and leave it alone when a plain model row is chosen', async () => {
    const user = userEventSetup();
    api.updateConversation.mockImplementation(async (token, id, patch) => ({
      id, title: 'T', settings: { presetId: 'p-review', systemPrompt: null }, ...patch,
    }));
    openConversation(thread(), { settings: { presetId: 'p-review', systemPrompt: null }, target: { model: 'qwen3:14b', nodeId: null } });
    await screen.findByText('Hello there');

    await user.click(screen.getByRole('button', { name: /qwen3:14b/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a model' });
    const selected = within(dialog).getAllByRole('option', { selected: true });
    expect(selected.some((o) => o.textContent.includes('Code reviewer'))).toBe(true);

    await user.click(within(dialog).getAllByRole('option', { name: /llama3\.1:8b/ }).find((o) => !o.textContent.includes('Quick')));

    await waitFor(() =>
      expect(api.updateConversation).toHaveBeenCalledWith('jwt', 'c9', { target: { model: 'llama3.1:8b', nodeId: null } })
    );
    expect(screen.getByRole('button', { name: 'Code reviewer' })).toBeInTheDocument();
  });

  it('should filter presets with the search box', async () => {
    const user = userEventSetup();
    renderPage();
    await waitForReady();

    await user.click(screen.getByRole('button', { name: /llama3\.1:8b/ }));
    await user.type(screen.getByRole('combobox'), 'blunt');

    const options = within(screen.getByRole('dialog')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Code reviewer');
  });
});

describe('presets manager from the settings', () => {
  it('should open the manager, close it on Escape without closing the settings, and return focus to its opener', async () => {
    const user = userEventSetup();
    renderPage();
    await waitForReady();
    await openSettings(user);

    const opener = screen.getByRole('button', { name: 'Manage presets' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Presets' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Presets' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Chat settings' })).toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('should close the settings on Escape and give focus back to the settings button', async () => {
    const user = userEventSetup();
    renderPage();
    await waitForReady();
    await openSettings(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Chat settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat settings' })).toHaveFocus();
  });

  it('should offer shared presets only to admins', async () => {
    const user = userEventSetup();
    setupApiDefaults({ admin: true });
    renderPage();
    await waitForReady();
    await openSettings(user);
    await user.click(screen.getByRole('button', { name: 'Manage presets' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Presets' })).getByRole('button', { name: /new preset/i }));

    expect(screen.getByRole('combobox', { name: 'Visibility' })).toBeInTheDocument();
  });
});
