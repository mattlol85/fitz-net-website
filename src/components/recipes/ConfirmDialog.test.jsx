import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';

const setup = (props = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ConfirmDialog title="Delete it?" message="For good." onConfirm={onConfirm} onCancel={onCancel} {...props} />);
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('should be an accessible dialog with focus on the safe choice', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Delete it?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('For good.');
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus();
  });

  it('should confirm or cancel from the buttons', async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should cancel on Escape and keep Tab inside the dialog', async () => {
    const { onCancel } = setup();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable the buttons and show the error while working', () => {
    setup({ busy: true, error: 'It failed.' });
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('It failed.');
  });
});
