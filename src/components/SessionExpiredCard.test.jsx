import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SessionExpiredCard from './SessionExpiredCard';

const renderCard = (props = {}) => {
  const onSignIn = props.onSignIn ?? vi.fn(async () => ({ success: true }));
  const onSignOut = props.onSignOut ?? vi.fn();
  render(<SessionExpiredCard username="matt" onSignIn={onSignIn} onSignOut={onSignOut} />);
  return { onSignIn, onSignOut, user: userEvent.setup() };
};

describe('SessionExpiredCard', () => {
  it('shows the signed-in username and focuses the password field', () => {
    renderCard();

    expect(screen.getByRole('alertdialog', { name: 'Your session has expired' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('matt');
    expect(screen.getByLabelText('Username')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('signs in again with the password', async () => {
    const { onSignIn, user } = renderCard();

    await user.type(screen.getByLabelText('Password'), 'hunter2{Enter}');

    expect(onSignIn).toHaveBeenCalledWith('hunter2');
  });

  it('shows the error and clears the password when sign-in fails', async () => {
    const { user } = renderCard({ onSignIn: vi.fn(async () => ({ success: false, message: 'Invalid username or password' })) });

    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('shows a fallback error when sign-in throws', async () => {
    const { user } = renderCard({ onSignIn: vi.fn(async () => Promise.reject(new Error('offline'))) });

    await user.type(screen.getByLabelText('Password'), 'pw{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign in. Please try again.');
  });

  it('signs out', async () => {
    const { onSignOut, user } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the card and keys away from the page', async () => {
    const onPageKey = vi.fn();
    document.addEventListener('keydown', onPageKey);
    const { user } = renderCard();

    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onPageKey).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onPageKey);
  });
});
