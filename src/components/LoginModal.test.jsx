import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginModal from './LoginModal.jsx';
import * as AuthContext from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const renderModal = () =>
  render(
    <MemoryRouter>
      <LoginModal logo="/ln.png" siteName="Lori-Net" />
    </MemoryRouter>
  );

describe('LoginModal', () => {
  let login;

  beforeEach(() => {
    login = vi.fn();
    AuthContext.useAuth.mockReturnValue({ login });
  });

  it('should render a labelled modal dialog with the site name and logo', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: /welcome to lori-net/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByAltText('Lori-Net logo')).toHaveAttribute('src', '/ln.png');
    expect(screen.getByLabelText('Username')).toHaveFocus();
  });

  it('should keep Sign in disabled until both fields are filled', async () => {
    renderModal();
    const submit = screen.getByRole('button', { name: 'Sign in' });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Username'), 'lori');
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    expect(submit).toBeEnabled();
  });

  it('should sign in through AuthContext.login', async () => {
    login.mockResolvedValue({ success: true });
    renderModal();

    await userEvent.type(screen.getByLabelText('Username'), 'lori');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(login).toHaveBeenCalledWith('lori', 'secret');
  });

  it('should show the error and clear the password when sign-in fails', async () => {
    login.mockResolvedValue({ success: false, message: 'Invalid password' });
    renderModal();

    await userEvent.type(screen.getByLabelText('Username'), 'lori');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid password');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveFocus());
  });

  it('should show a generic error when login throws', async () => {
    login.mockRejectedValue(new Error('network'));
    renderModal();

    await userEvent.type(screen.getByLabelText('Username'), 'lori');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not sign in/i);
  });

  it('should link to account registration', () => {
    renderModal();
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register');
  });
});
