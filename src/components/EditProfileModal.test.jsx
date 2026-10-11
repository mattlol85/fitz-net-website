import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditProfileModal from './EditProfileModal.jsx';
import * as AuthContext from '../contexts/AuthContext';

// Mock the AuthContext hook
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('EditProfileModal', () => {
  const mockUpdateProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    AuthContext.useAuth.mockReturnValue({
      updateProfile: mockUpdateProfile,
    });
  });

  it('renders modal when isOpen is true', () => {
    render(
      <EditProfileModal
        isOpen={true}
        onClose={() => {}}
        currentUser={{ username: 'testuser', email: 'test@example.com' }}
      />
    );

    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    const { container } = render(
      <EditProfileModal
        isOpen={false}
        onClose={() => {}}
        currentUser={{ username: 'testuser', email: 'test@example.com' }}
      />
    );

    expect(container.querySelector('.modal-overlay')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <EditProfileModal
        isOpen={true}
        onClose={onClose}
        currentUser={{ username: 'testuser', email: 'test@example.com' }}
      />
    );

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <EditProfileModal
        isOpen={true}
        onClose={onClose}
        currentUser={{ username: 'testuser', email: 'test@example.com' }}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('submits form with updated data', async () => {
    mockUpdateProfile.mockResolvedValue({ success: true });
    const onClose = vi.fn();

    render(
      <EditProfileModal
        isOpen={true}
        onClose={onClose}
        currentUser={{ username: 'olduser', email: 'old@example.com' }}
      />
    );

    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByText('Save Changes');

    fireEvent.change(usernameInput, { target: { value: 'newuser' } });
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@example.com',
        password: undefined,
      });
    });
  });

  it('validates email format', async () => {
    const onClose = vi.fn();

    render(
      <EditProfileModal
        isOpen={true}
        onClose={onClose}
        currentUser={{ username: 'testuser', email: 'test@example.com' }}
      />
    );

    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByText('Save Changes');

    fireEvent.change(emailInput, { target: { value: 'invalidemail' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('validates password confirmation matches', async () => {
    const onClose = vi.fn();

    render(
      <EditProfileModal
        isOpen={true}
        onClose={onClose}
        currentUser={{ username: 'testuser', email: 'test@example.com' }}
      />
    );

    const passwordInput = screen.getByLabelText('New Password');
    const confirmInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByText('Save Changes');

    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } });
    fireEvent.change(confirmInput, { target: { value: 'differentpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });
});

describe('EditProfileModal outcomes', () => {
  const mockUpdateProfile = vi.fn();

  const openModal = (props = {}) => {
    const onClose = vi.fn();
    const utils = render(
      <EditProfileModal
        isOpen={true}
        onClose={onClose}
        currentUser={{ username: 'testuser', email: 'test@example.com', boardColor: 'hsl(9,9%,9%)' }}
        {...props}
      />
    );
    return { ...utils, onClose };
  };

  it('should require a username and email before saving', () => {
    AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
    openModal();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Username and email are required')).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('should reject a new password shorter than six characters', () => {
    AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
    openModal();

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('should confirm success and close the modal after a short pause', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockUpdateProfile.mockResolvedValueOnce({ success: true });
      AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
      const { onClose } = openModal();

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(await screen.findByText('Profile updated successfully!')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should show the reason when the update is rejected', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ success: false, message: 'Username taken' });
    AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Username taken')).toBeInTheDocument();
  });

  it('should show a generic failure when a rejection has no reason', async () => {
    mockUpdateProfile.mockResolvedValueOnce({ success: false });
    AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Failed to update profile')).toBeInTheDocument();
  });

  it('should show a friendly message when the update throws unexpectedly', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('network'));
    AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
    openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('should render an empty form when no current user is supplied', () => {
    AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
    openModal({ currentUser: undefined });

    expect(screen.getByLabelText('Username')).toHaveValue('');
    expect(screen.getByText('hsl(200,72%,50%)')).toBeInTheDocument();
  });

  it('should close when the backdrop is clicked but not when the dialog is clicked', () => {
    AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
    const { container, onClose } = openModal();

    fireEvent.click(container.querySelector('.modal-content'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close from the header close button', () => {
    AuthContext.useAuth.mockReturnValue({ updateProfile: mockUpdateProfile });
    const { onClose } = openModal();

    fireEvent.click(screen.getByRole('button', { name: '\u00d7' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
