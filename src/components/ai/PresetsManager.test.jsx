import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PresetsManager, { toPayload, validatePreset } from './PresetsManager';
import { makeCatalogue, NODE_GARAGE, NODE_PC } from './aiTestData';

afterEach(cleanup);

const OWN = {
  id: 'p1', name: 'Code reviewer', description: 'Blunt', model: 'qwen3:14b', nodeId: NODE_PC,
  systemPrompt: 'Review code.', temperature: 0.2, numCtx: 8192, visibility: 'private',
  requiredPermission: null, ownerUsername: 'matt', editable: true,
};
const SHARED = {
  id: 'p2', name: 'House style', description: null, model: null, nodeId: null, systemPrompt: 'British English.',
  temperature: null, numCtx: null, visibility: 'shared', requiredPermission: null, ownerUsername: 'admin', editable: false,
};

function setup({ items = [OWN, SHARED], canShare = false, save, remove } = {}) {
  const presets = {
    items,
    loading: false,
    error: null,
    save: save || vi.fn().mockResolvedValue({}),
    remove: remove || vi.fn().mockResolvedValue(undefined),
  };
  const onClose = vi.fn();
  render(<PresetsManager presets={presets} catalogue={makeCatalogue()} canShare={canShare} onClose={onClose} />);
  return { presets, onClose };
}

const dialog = () => screen.getByRole('dialog', { name: 'Presets' });

describe('PresetsManager list', () => {
  it('should list presets with visibility, owner and read-only badges', () => {
    setup();

    const rows = within(dialog()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Private')).toBeInTheDocument();
    expect(within(rows[0]).getByText('by matt')).toBeInTheDocument();
    expect(within(rows[0]).getByText('qwen3:14b')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Shared')).toBeInTheDocument();
    expect(within(rows[1]).getByText('by admin')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Read only')).toBeInTheDocument();
  });

  it('should offer Edit and Delete only on presets the caller can change', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Edit Code reviewer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Code reviewer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View House style' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete House style' })).not.toBeInTheDocument();
  });

  it('should delete only after a second confirmation', async () => {
    const user = userEvent.setup();
    const { presets } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Code reviewer' }));
    expect(presets.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(presets.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete Code reviewer' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(presets.remove).toHaveBeenCalledWith('p1');
  });

  it('should show why a delete failed', async () => {
    const user = userEvent.setup();
    setup({ remove: vi.fn().mockRejectedValue(new Error('You cannot delete this preset.')) });

    await user.click(screen.getByRole('button', { name: 'Delete Code reviewer' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot delete this preset.');
  });

  it('should explain an empty list', () => {
    setup({ items: [] });

    expect(screen.getByText(/no presets yet/i)).toBeInTheDocument();
  });
});

describe('PresetsManager form', () => {
  it('should create a preset with every field from the contract', async () => {
    const user = userEvent.setup();
    const { presets } = setup({ items: [] });

    await user.click(screen.getByRole('button', { name: /new preset/i }));
    await user.type(screen.getByLabelText('Name'), '  Reviewer ');
    await user.type(screen.getByLabelText('Description'), 'Blunt');
    await user.selectOptions(screen.getByLabelText('Model'), 'qwen3:14b');
    await user.selectOptions(screen.getByLabelText('Node'), NODE_PC);
    await user.type(screen.getByLabelText('System prompt'), 'Review code.');
    await user.type(screen.getByLabelText('Temperature'), '0.3');
    await user.type(screen.getByLabelText('Context size'), '4096');
    await user.click(screen.getByRole('button', { name: 'Save preset' }));

    await waitFor(() =>
      expect(presets.save).toHaveBeenCalledWith(
        {
          name: 'Reviewer', description: 'Blunt', model: 'qwen3:14b', nodeId: NODE_PC, systemPrompt: 'Review code.',
          temperature: 0.3, numCtx: 4096, visibility: 'private', requiredPermission: null,
        },
        undefined
      )
    );
    // Back on the list afterwards.
    expect(await screen.findByRole('button', { name: /new preset/i })).toBeInTheDocument();
  });

  it('should only offer a node once a model is chosen, and only nodes that have that model', async () => {
    const user = userEvent.setup();
    setup({ items: [] });
    await user.click(screen.getByRole('button', { name: /new preset/i }));
    expect(screen.queryByLabelText('Node')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Model'), 'phi3:mini');

    const options = within(screen.getByLabelText('Node')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Auto', 'Garage-Laptop (offline)']);
    expect(NODE_GARAGE).toBe('node-garage');
  });

  it('should send null for the empty optional fields and keep temperature 0', async () => {
    const user = userEvent.setup();
    const { presets } = setup({ items: [] });
    await user.click(screen.getByRole('button', { name: /new preset/i }));

    await user.type(screen.getByLabelText('Name'), 'Plain');
    await user.type(screen.getByLabelText('Temperature'), '0');
    await user.click(screen.getByRole('button', { name: 'Save preset' }));

    await waitFor(() => expect(presets.save).toHaveBeenCalled());
    expect(presets.save.mock.calls[0][0]).toEqual({
      name: 'Plain', description: null, model: null, nodeId: null, systemPrompt: null,
      temperature: 0, numCtx: null, visibility: 'private', requiredPermission: null,
    });
  });

  it('should edit an existing preset with its values filled in', async () => {
    const user = userEvent.setup();
    const { presets } = setup();

    await user.click(screen.getByRole('button', { name: 'Edit Code reviewer' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Code reviewer');
    expect(screen.getByLabelText('Model')).toHaveValue('qwen3:14b');
    expect(screen.getByLabelText('Node')).toHaveValue(NODE_PC);
    expect(screen.getByLabelText('Temperature')).toHaveValue(0.2);
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Strict reviewer');
    await user.click(screen.getByRole('button', { name: 'Save preset' }));

    await waitFor(() => expect(presets.save).toHaveBeenCalled());
    expect(presets.save.mock.calls[0][0]).toMatchObject({ name: 'Strict reviewer', model: 'qwen3:14b', nodeId: NODE_PC });
    expect(presets.save.mock.calls[0][1]).toBe('p1');
  });

  it('should open a preset that is not editable read-only, without a Save button', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'View House style' }));

    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByLabelText('System prompt')).toBeDisabled();
    expect(screen.getByLabelText('System prompt')).toHaveValue('British English.');
    expect(screen.queryByRole('button', { name: 'Save preset' })).not.toBeInTheDocument();
    expect(screen.getByText(/only an admin can change it/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /new preset/i })).toBeInTheDocument();
  });

  it('should offer shared visibility and the required permission only to admins', async () => {
    const user = userEvent.setup();
    const { presets } = setup({ items: [], canShare: true });
    await user.click(screen.getByRole('button', { name: /new preset/i }));
    expect(screen.queryByLabelText('Required permission')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Team');
    await user.selectOptions(screen.getByLabelText('Visibility'), 'shared');
    await user.type(screen.getByLabelText('Required permission'), 'JOENET_USER');
    await user.click(screen.getByRole('button', { name: 'Save preset' }));

    await waitFor(() => expect(presets.save).toHaveBeenCalled());
    expect(presets.save.mock.calls[0][0]).toMatchObject({ visibility: 'shared', requiredPermission: 'JOENET_USER' });
  });

  it('should not show the visibility controls to non-admins and always save as private', async () => {
    const user = userEvent.setup();
    const { presets } = setup({ items: [], canShare: false });
    await user.click(screen.getByRole('button', { name: /new preset/i }));

    expect(screen.queryByLabelText('Visibility')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save preset' }));

    await waitFor(() => expect(presets.save).toHaveBeenCalled());
    expect(presets.save.mock.calls[0][0].visibility).toBe('private');
  });

  it('should show the server error inline and stay on the form', async () => {
    const user = userEvent.setup();
    setup({ items: [], save: vi.fn().mockRejectedValue(new Error('Only an admin can create or change shared presets.')) });
    await user.click(screen.getByRole('button', { name: /new preset/i }));
    await user.type(screen.getByLabelText('Name'), 'Team');

    await user.click(screen.getByRole('button', { name: 'Save preset' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only an admin can create or change shared presets.');
    expect(screen.getByLabelText('Name')).toHaveValue('Team');
    expect(screen.getByRole('button', { name: 'Save preset' })).toBeEnabled();
  });

  it('should validate before saving and show what is wrong', async () => {
    const user = userEvent.setup();
    const { presets } = setup({ items: [] });
    await user.click(screen.getByRole('button', { name: /new preset/i }));

    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Context size'), { target: { value: '100' } });
    await user.click(screen.getByRole('button', { name: 'Save preset' }));

    expect(presets.save).not.toHaveBeenCalled();
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alerts).toEqual(
      expect.arrayContaining([
        'Name must be 1 to 60 characters.',
        'Temperature must be between 0 and 2.',
        'Context size must be a whole number from 512 to 131072.',
      ])
    );
  });
});

describe('preset validation helpers', () => {
  const base = { name: 'x', description: '', model: '', nodeId: '', systemPrompt: '', temperature: '', numCtx: '', visibility: 'private', requiredPermission: '' };

  it('should accept the contract limits and reject values just outside them', () => {
    expect(validatePreset({ ...base, name: 'n'.repeat(60), temperature: '2', numCtx: '131072', description: 'd'.repeat(200) })).toEqual({});
    expect(Object.keys(validatePreset({ ...base, name: 'n'.repeat(61) }))).toEqual(['name']);
    expect(Object.keys(validatePreset({ ...base, description: 'd'.repeat(201) }))).toEqual(['description']);
    expect(Object.keys(validatePreset({ ...base, systemPrompt: 's'.repeat(8001) }))).toEqual(['systemPrompt']);
    expect(Object.keys(validatePreset({ ...base, temperature: '-0.1' }))).toEqual(['temperature']);
    expect(Object.keys(validatePreset({ ...base, numCtx: '511' }))).toEqual(['numCtx']);
    expect(Object.keys(validatePreset({ ...base, numCtx: '512.5' }))).toEqual(['numCtx']);
  });

  it('should drop the node when no model is chosen and ignore sharing for non-admins', () => {
    expect(toPayload({ ...base, nodeId: 'n1', visibility: 'shared', requiredPermission: 'X' }, false)).toMatchObject({
      nodeId: null, visibility: 'private', requiredPermission: null,
    });
  });
});
