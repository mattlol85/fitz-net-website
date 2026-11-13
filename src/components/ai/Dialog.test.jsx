import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dialog from './Dialog';

afterEach(cleanup);

function Harness({ variant = 'modal', onClose = vi.fn() }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Elsewhere</button>
      {open && (
        <Dialog
          label="Example"
          variant={variant}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <button type="button">First</button>
          <input aria-label="Middle" />
          <button type="button">Last</button>
        </Dialog>
      )}
    </div>
  );
}

describe('Dialog', () => {
  it('should move focus inside when it opens', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog', { name: 'Example' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('should keep Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    screen.getByRole('button', { name: 'Last' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Elsewhere' })).not.toHaveFocus();
  });

  it('should close on Escape and give focus back to what opened it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('should mark a modal as modal and close it from the backdrop', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should close a popover on an outside click without stealing focus back', async () => {
    const user = userEvent.setup();
    render(<Harness variant="popover" />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-modal');

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });
});
