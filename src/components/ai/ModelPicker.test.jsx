import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModelPicker, { buildGroups } from './ModelPicker';
import { makeCatalogue, NODE_GARAGE, NODE_PC, NODE_RIG } from './aiTestData';

afterEach(cleanup);

const AUTO_LLAMA = { model: 'llama3.1:8b', nodeId: null };

function setup(props = {}) {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  const onRefresh = vi.fn();
  const utils = render(
    <ModelPicker
      catalogue={makeCatalogue()}
      loading={false}
      error={null}
      target={AUTO_LLAMA}
      onSelect={onSelect}
      onOpenChange={onOpenChange}
      onRefresh={onRefresh}
      {...props}
    />
  );
  return { onSelect, onOpenChange, onRefresh, ...utils };
}

const openPicker = async (user) => {
  await user.click(screen.getByRole('button', { name: /llama3\.1:8b/i }));
  return screen.getByRole('dialog', { name: /choose a model/i });
};

describe('ModelPicker', () => {
  it('should show the current model with Auto, or with the node name when one is pinned', () => {
    const { unmount } = setup();
    expect(screen.getByRole('button', { name: /llama3\.1:8b\s*Auto/ })).toBeInTheDocument();
    unmount();

    setup({ target: { model: 'qwen3:14b', nodeId: NODE_PC } });
    expect(screen.getByRole('button', { name: /qwen3:14b\s*Matt-PC/ })).toBeInTheDocument();
  });

  it('should invite a choice when there is no target yet', () => {
    setup({ target: null });

    expect(screen.getByRole('button', { name: /select a model/i })).toBeInTheDocument();
  });

  it('should group rows into Auto first, then one group per node with status and VRAM', async () => {
    const user = userEvent.setup();
    setup();

    const dialog = await openPicker(user);

    const groups = within(dialog).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-labelledby') && g.querySelector('.ai-chat__group-name').textContent)).toEqual([
      'Auto',
      'Garage-Laptop',
      'Matt-PC',
      'Rig-2',
    ]);
    const auto = within(groups[0]).getAllByRole('option');
    expect(auto).toHaveLength(3);
    expect(within(auto[0]).getByText('2 nodes')).toBeInTheDocument();
    expect(within(auto[0]).getByText('Loaded')).toBeInTheDocument();
    expect(within(auto[0]).getByText('8.0B')).toBeInTheDocument();
    expect(within(auto[0]).getByText('Q4_K_M')).toBeInTheDocument();
    expect(within(auto[0]).getByText('8K ctx')).toBeInTheDocument();

    expect(within(groups[2]).getByText('Online')).toBeInTheDocument();
    expect(within(groups[2]).getByText('9.0 / 16.0 GB')).toBeInTheDocument();
    expect(within(groups[1]).getByText('Offline')).toBeInTheDocument();
    expect(within(groups[1]).getByText('cached')).toBeInTheDocument();
    expect(within(groups[3]).getByText('Busy')).toBeInTheDocument();
    expect(within(groups[3]).getByText('24.0 GB total')).toBeInTheDocument();
  });

  it('should show loaded and capability hints on node rows', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openPicker(user);

    const pcGroup = within(dialog).getAllByRole('group')[2];
    const rows = within(pcGroup).getAllByRole('option');
    expect(within(rows[0]).getByText('Loaded')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Vision')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Thinking')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('Loaded')).not.toBeInTheDocument();
  });

  it('should mark the current target as selected', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openPicker(user);

    const selected = within(dialog).getAllByRole('option', { selected: true });
    expect(selected).toHaveLength(1);
    expect(within(selected[0]).getByText('2 nodes')).toBeInTheDocument();
  });

  it('should filter by model name and by node name', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openPicker(user);
    const search = within(dialog).getByRole('combobox', { name: /search/i });

    await user.type(search, 'vision');
    expect(within(dialog).getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('llama3.2-vision:11b'),
      expect.stringContaining('llama3.2-vision:11b'),
    ]);
    expect(within(dialog).queryByText('Rig-2')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'rig');
    const options = within(dialog).getAllByRole('option');
    // The Auto row for llama3.1:8b (Rig-2 has it) plus Rig-2's own row.
    expect(options).toHaveLength(2);
    expect(within(dialog).getByText('Rig-2')).toBeInTheDocument();
    expect(within(dialog).queryByText('Matt-PC')).not.toBeInTheDocument();
  });

  it('should say when nothing matches', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openPicker(user);

    await user.type(within(dialog).getByRole('combobox'), 'zzz');

    expect(within(dialog).getByText(/no models or nodes match/i)).toBeInTheDocument();
  });

  it('should grey out offline rows and not select them', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();
    const dialog = await openPicker(user);

    const offlineRow = within(within(dialog).getAllByRole('group')[1]).getByRole('option');
    expect(offlineRow).toHaveAttribute('aria-disabled', 'true');

    await user.click(offlineRow);

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should select a node row on click, close and give focus back to the button', async () => {
    const user = userEvent.setup();
    const { onSelect, onOpenChange } = setup();
    const dialog = await openPicker(user);

    await user.click(within(within(dialog).getAllByRole('group')[3]).getByRole('option'));

    expect(onSelect).toHaveBeenCalledWith({ model: 'llama3.1:8b', nodeId: NODE_RIG });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /llama3\.1:8b/i })).toHaveFocus();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('should select an Auto row as nodeId null', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup({ target: null });
    await user.click(screen.getByRole('button', { name: /select a model/i }));

    // The Auto row comes first; Matt-PC's own qwen3:14b row follows it.
    await user.click(screen.getAllByRole('option', { name: /qwen3:14b/ })[0]);

    expect(onSelect).toHaveBeenCalledWith({ model: 'qwen3:14b', nodeId: null });
  });

  it('should move with the arrow keys and select with Enter, skipping offline rows', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();
    await openPicker(user);
    const search = screen.getByRole('combobox');
    expect(search).toHaveFocus();
    // Opens on the current selection: Auto llama3.1:8b.
    expect(search).toHaveAttribute('aria-activedescendant', expect.stringContaining('auto:llama3.1:8b'));

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(search.getAttribute('aria-activedescendant')).toContain('auto:qwen3:14b');

    // Auto has 3 rows; the next enabled one is Matt-PC's first (the offline Garage row is skipped).
    await user.keyboard('{ArrowDown}');
    expect(search.getAttribute('aria-activedescendant')).toContain(`${NODE_PC}:llama3.1:8b`);
    expect(search.getAttribute('aria-activedescendant')).not.toContain(NODE_GARAGE);

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith({ model: 'llama3.2-vision:11b', nodeId: NODE_PC });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should select the first match with Enter after typing', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();
    await openPicker(user);

    await user.keyboard('qwen{Enter}');

    expect(onSelect).toHaveBeenCalledWith({ model: 'qwen3:14b', nodeId: null });
  });

  it('should open with Ctrl+K and Cmd+K from anywhere on the page', async () => {
    const { onOpenChange } = setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: /choose a model/i })).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'K', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('should close on Escape with focus back on the button, and on an outside click', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();

    await openPicker(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /llama3\.1:8b/i })).toHaveFocus();

    await openPicker(user);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('should expose dialog, combobox and listbox semantics', async () => {
    const user = userEvent.setup();
    setup();

    const button = screen.getByRole('button', { name: /llama3\.1:8b/i });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    const dialog = await openPicker(user);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    const search = within(dialog).getByRole('combobox');
    expect(search).toHaveAttribute('aria-controls', within(dialog).getByRole('listbox').id);
  });

  it('should refresh the catalogue on request', async () => {
    const user = userEvent.setup();
    const { onRefresh } = setup();
    const dialog = await openPicker(user);

    await user.click(within(dialog).getByRole('button', { name: /refresh models/i }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should show loading, failure and empty states', async () => {
    const user = userEvent.setup();
    const { unmount } = setup({ catalogue: null, loading: true, target: null });
    await user.click(screen.getByRole('button', { name: /select a model/i }));
    expect(screen.getByText(/loading models/i)).toBeInTheDocument();
    unmount();

    const failing = setup({ catalogue: null, loading: false, error: 'HTTP 503', target: null });
    await user.click(screen.getByRole('button', { name: /select a model/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/HTTP 503/);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(failing.onRefresh).toHaveBeenCalled();
    failing.unmount();

    setup({ catalogue: { generatedAt: 'x', nodes: [], models: [] }, target: null });
    await user.click(screen.getByRole('button', { name: /select a model/i }));
    expect(screen.getByText(/no models available/i)).toBeInTheDocument();
  });
});

describe('buildGroups', () => {
  it('should return no groups without a catalogue', () => {
    expect(buildGroups(null, '')).toEqual([]);
  });

  it('should mark every row of an offline node as disabled', () => {
    const groups = buildGroups(makeCatalogue(), '');

    const garage = groups.find((g) => g.node?.id === NODE_GARAGE);
    expect(garage.rows.every((r) => r.disabled)).toBe(true);
    expect(groups.find((g) => g.node?.id === NODE_PC).rows.some((r) => r.disabled)).toBe(false);
  });
});
