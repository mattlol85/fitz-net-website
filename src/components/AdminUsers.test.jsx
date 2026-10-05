import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminUsers from './AdminUsers.jsx';
import * as AuthContext from '../contexts/AuthContext';
import * as api from '../services/api';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('AdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AuthContext.useAuth.mockReturnValue({ token: 'tok', user: { username: 'root' } });
    api.getAvailablePermissions.mockResolvedValue({
      success: true,
      data: [
        { name: 'ADMIN', description: 'Manage users' },
        { name: 'RADARR', description: '' },
      ],
    });
    api.getAdminUsers.mockResolvedValue({
      success: true,
      data: [
        { id: '1', username: 'root', permissions: ['ADMIN'] },
        { id: '2', username: 'alice', permissions: [] },
      ],
    });
  });

  it('lists users with their current permissions', async () => {
    render(<AdminUsers />);
    expect(await screen.findByLabelText('ADMIN for root')).toBeChecked();
    expect(screen.getByLabelText('RADARR for alice')).not.toBeChecked();
  });

  it('prevents the admin from removing their own ADMIN permission', async () => {
    render(<AdminUsers />);
    expect(await screen.findByLabelText('ADMIN for root')).toBeDisabled();
    expect(screen.getByLabelText('ADMIN for alice')).not.toBeDisabled();
  });

  it('saves changed permissions for a user', async () => {
    api.setUserPermissions.mockResolvedValue({
      success: true,
      data: { username: 'alice', permissions: ['RADARR'] },
    });
    render(<AdminUsers />);

    fireEvent.click(await screen.findByLabelText('RADARR for alice'));
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    expect(saveButtons[0]).toBeDisabled();
    fireEvent.click(saveButtons[1]);

    await waitFor(() =>
      expect(api.setUserPermissions).toHaveBeenCalledWith('alice', ['RADARR'], 'tok')
    );
    expect(await screen.findByText('Updated permissions for alice')).toBeInTheDocument();
  });

  it('shows an error when saving fails', async () => {
    api.setUserPermissions.mockResolvedValue({ success: false, message: 'Forbidden' });
    render(<AdminUsers />);

    fireEvent.click(await screen.findByLabelText('RADARR for alice'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[1]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });

  it('creates a new permission and reloads the list', async () => {
    api.createPermission.mockResolvedValue({ success: true, data: { name: 'SONARR' } });
    render(<AdminUsers />);

    fireEvent.change(await screen.findByLabelText('New permission name'), {
      target: { value: 'sonarr' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add permission' }));

    await waitFor(() => expect(api.createPermission).toHaveBeenCalledWith('SONARR', '', 'tok'));
    expect(await screen.findByText('Created permission SONARR')).toBeInTheDocument();
    expect(api.getAdminUsers).toHaveBeenCalledTimes(2);
  });

  it('requires a second click to delete a permission and never offers ADMIN', async () => {
    api.deletePermission.mockResolvedValue({ success: true });
    render(<AdminUsers />);

    expect(await screen.findByLabelText('RADARR for alice')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete ADMIN' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete RADARR' }));
    expect(api.deletePermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(api.deletePermission).toHaveBeenCalledWith('RADARR', 'tok'));
  });

  it('keeps unsaved edits when the permission list reloads', async () => {
    api.createPermission.mockResolvedValue({ success: true, data: { name: 'SONARR' } });
    render(<AdminUsers />);

    fireEvent.click(await screen.findByLabelText('RADARR for alice'));
    fireEvent.change(screen.getByLabelText('New permission name'), { target: { value: 'sonarr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add permission' }));

    await waitFor(() => expect(api.getAdminUsers).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('RADARR for alice')).toBeChecked();
  });
});
