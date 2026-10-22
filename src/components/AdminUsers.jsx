import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createPermission,
  deletePermission,
  getAdminUsers,
  getAvailablePermissions,
  setUserPermissions,
} from '../services/api';
import AdminUserCard from './AdminUserCard.jsx';
import PermissionCatalogue from './PermissionCatalogue.jsx';
import '../css/AdminUsers.css';

function AdminUsers() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [available, setAvailable] = useState([]);
  // Unsaved permission edits only (username -> permissions); survives reloads of the list.
  const [edits, setEdits] = useState({});
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, permsRes] = await Promise.all([
      getAdminUsers(token),
      getAvailablePermissions(token),
    ]);

    if (!usersRes.success || !permsRes.success) {
      setStatus({ type: 'error', message: usersRes.message || permsRes.message || 'Failed to load users' });
    } else {
      setUsers(usersRes.data);
      setAvailable(permsRes.data);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const addPermission = async (event) => {
    event.preventDefault();
    const response = await createPermission(newName.trim().toUpperCase(), newDescription.trim(), token);
    if (response.success) {
      setStatus({ type: 'success', message: `Created permission ${response.data.name}` });
      setNewName('');
      setNewDescription('');
      await load();
    } else {
      setStatus({ type: 'error', message: response.message });
    }
  };

  const removePermission = async (name) => {
    // Two-step confirm: first click arms the button, second click deletes.
    if (pendingDelete !== name) {
      setPendingDelete(name);
      return;
    }
    setPendingDelete(null);
    const response = await deletePermission(name, token);
    if (response.success) {
      setStatus({ type: 'success', message: `Deleted permission ${name} and revoked it from all users` });
      await load();
    } else {
      setStatus({ type: 'error', message: response.message });
    }
  };

  const draftFor = (u) => edits[u.username] ?? u.permissions ?? [];

  const toggle = (u, permission) => {
    const current = draftFor(u);
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    setEdits((prev) => ({ ...prev, [u.username]: next }));
  };

  const discard = (u) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[u.username];
      return next;
    });
  };

  const isDirty = (u) => {
    const saved = [...(u.permissions ?? [])].sort().join(',');
    const draft = [...draftFor(u)].sort().join(',');
    return saved !== draft;
  };

  const save = async (u) => {
    const response = await setUserPermissions(u.username, draftFor(u), token);
    if (response.success) {
      setUsers((prev) =>
        prev.map((x) => (x.username === u.username ? { ...x, permissions: response.data.permissions } : x))
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[u.username];
        return next;
      });
      setStatus({ type: 'success', message: `Updated permissions for ${u.username}` });
    } else {
      setStatus({ type: 'error', message: response.message });
    }
  };

  const query = search.trim().toLowerCase();
  const visibleUsers = users.filter((u) => u.username.toLowerCase().includes(query));

  return (
    <div className="admin-users-container">
      <h1 className="admin-users-title">User Permissions</h1>

      {status.message && (
        <div role={status.type === 'error' ? 'alert' : 'status'} className={`admin-users-message ${status.type}`}>
          {status.message}
        </div>
      )}

      {loading && users.length === 0 ? (
        <p>Loading users…</p>
      ) : (
        <>
          <div className="admin-toolbar">
            <input
              type="search"
              className="admin-input grow"
              aria-label="Search users"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="admin-toolbar-count">
              {visibleUsers.length} of {users.length} users
            </span>
          </div>

          {visibleUsers.length === 0 ? (
            <p className="admin-empty">No users match “{search.trim()}”.</p>
          ) : (
            <ul className="admin-user-grid">
              {visibleUsers.map((u) => (
                <AdminUserCard
                  key={u.username}
                  user={u}
                  draft={draftFor(u)}
                  available={available}
                  isSelf={u.username === currentUser?.username}
                  dirty={isDirty(u)}
                  onAdd={(name) => toggle(u, name)}
                  onRemove={(name) => toggle(u, name)}
                  onSave={() => save(u)}
                  onDiscard={() => discard(u)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <PermissionCatalogue
        available={available}
        pendingDelete={pendingDelete}
        onDelete={removePermission}
        onCancelDelete={() => setPendingDelete(null)}
        newName={newName}
        newDescription={newDescription}
        onNameChange={setNewName}
        onDescriptionChange={setNewDescription}
        onCreate={addPermission}
      />
    </div>
  );
}

export default AdminUsers;
