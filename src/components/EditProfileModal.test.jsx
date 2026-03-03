import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

