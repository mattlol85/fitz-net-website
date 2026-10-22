import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminUsers from './AdminUsers.jsx';
import * as AuthContext from '../contexts/AuthContext';
import * as api from '../services/api';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const addPermission = (username, name) =>
  fireEvent.change(screen.getByLabelText(`Add permission to ${username}`), { target: { value: name } });

const chipsFor = (username) => screen.getByRole('list', { name: `Permissions for ${username}` });

const seedApi = () => {
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
};

// Each user card has its own Save button; this picks the one inside a user's card.
const saveFor = (username) =>
  within(chipsFor(username).closest('li.admin-user-card')).getByRole('button', { name: 'Save' });

describe('AdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedApi();
  });

  it('lists users with their current permissions as chips', async () => {
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to root');
    expect(within(chipsFor('root')).getByText('ADMIN')).toBeInTheDocument();
    expect(within(chipsFor('alice')).getByText('No permissions')).toBeInTheDocument();
  });

  it('prevents the admin from removing their own ADMIN permission', async () => {
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to root');
    expect(screen.queryByRole('button', { name: 'Remove ADMIN from root' })).not.toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('only offers permissions the user does not have yet', async () => {
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to root');
    const rootSelect = screen.getByLabelText('Add permission to root');
    expect(within(rootSelect).queryByRole('option', { name: 'ADMIN' })).not.toBeInTheDocument();
    expect(within(rootSelect).getByRole('option', { name: 'RADARR' })).toBeInTheDocument();
    const aliceSelect = screen.getByLabelText('Add permission to alice');
    expect(within(aliceSelect).getByRole('option', { name: 'ADMIN' })).toBeInTheDocument();
  });

  it('saves changed permissions for a user', async () => {
    api.setUserPermissions.mockResolvedValue({
      success: true,
      data: { username: 'alice', permissions: ['RADARR'] },
    });
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to alice');

    expect(saveFor('root')).toBeDisabled();
    addPermission('alice', 'RADARR');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(saveFor('alice'));

    await waitFor(() =>
      expect(api.setUserPermissions).toHaveBeenCalledWith('alice', ['RADARR'], 'tok')
    );
    expect(await screen.findByText('Updated permissions for alice')).toBeInTheDocument();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('shows an error when saving fails', async () => {
    api.setUserPermissions.mockResolvedValue({ success: false, message: 'Forbidden' });
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to alice');

    addPermission('alice', 'RADARR');
    fireEvent.click(saveFor('alice'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });

  it('discards unsaved edits', async () => {
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to alice');

    addPermission('alice', 'RADARR');
    expect(within(chipsFor('alice')).getByText('RADARR')).toBeInTheDocument();
    fireEvent.click(
      within(chipsFor('alice').closest('li.admin-user-card')).getByRole('button', { name: 'Discard' })
    );

    expect(within(chipsFor('alice')).getByText('No permissions')).toBeInTheDocument();
    expect(saveFor('alice')).toBeDisabled();
  });

  it('filters users by search', async () => {
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to alice');

    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'ali' } });
    expect(screen.getByRole('list', { name: 'Permissions for alice' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Permissions for root' })).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2 users')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No users match/)).toBeInTheDocument();
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

    await screen.findByLabelText('Add permission to alice');
    expect(screen.queryByRole('button', { name: 'Delete ADMIN' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete RADARR' }));
    expect(api.deletePermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(api.deletePermission).toHaveBeenCalledWith('RADARR', 'tok'));
  });

  it('keeps unsaved edits when the permission list reloads', async () => {
    api.createPermission.mockResolvedValue({ success: true, data: { name: 'SONARR' } });
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to alice');

    addPermission('alice', 'RADARR');
    fireEvent.change(screen.getByLabelText('New permission name'), { target: { value: 'sonarr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add permission' }));

    await waitFor(() => expect(api.getAdminUsers).toHaveBeenCalledTimes(2));
    expect(within(chipsFor('alice')).getByText('RADARR')).toBeInTheDocument();
  });
});

describe('AdminUsers error paths and editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedApi();
  });

  it('shows the API reason when the page cannot load', async () => {
    api.getAvailablePermissions.mockResolvedValueOnce({ success: false, message: 'Forbidden' });
    render(<AdminUsers />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });

  it('shows a generic message when the page fails to load without a reason', async () => {
    api.getAdminUsers.mockResolvedValueOnce({ success: false });
    render(<AdminUsers />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load users');
  });

  it('shows the API reason when creating a permission is refused', async () => {
    api.createPermission.mockResolvedValueOnce({ success: false, message: 'Name taken' });
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to root');

    fireEvent.change(screen.getByLabelText('New permission name'), { target: { value: 'radarr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add permission' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Name taken');
  });

  it('shows the API reason when deleting a permission is refused', async () => {
    api.deletePermission.mockResolvedValueOnce({ success: false, message: 'Still in use' });
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to root');

    fireEvent.click(screen.getByRole('button', { name: 'Delete RADARR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Still in use');
  });

  it('clears the delete confirmation when focus leaves the button', async () => {
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to root');

    fireEvent.click(screen.getByRole('button', { name: 'Delete RADARR' }));
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument();

    fireEvent.blur(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(screen.getByRole('button', { name: 'Delete RADARR' })).toBeInTheDocument();
  });

  it('adding then removing a permission makes the card clean again', async () => {
    render(<AdminUsers />);
    await screen.findByLabelText('Add permission to alice');

    addPermission('alice', 'ADMIN');
    expect(saveFor('alice')).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove ADMIN from alice' }));
    expect(saveFor('alice')).toBeDisabled();
  });
});
