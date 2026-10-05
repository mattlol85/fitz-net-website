import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createPermission,
  deletePermission,
  getAdminUsers,
  getAvailablePermissions,
  setUserPermissions,
} from '../services/api';
import '../css/AdminUsers.css';

function AdminUsers() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [available, setAvailable] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

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
      setDrafts(Object.fromEntries(usersRes.data.map((u) => [u.username, u.permissions ?? []])));
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

  const toggle = (username, permission) => {
    setDrafts((prev) => {
      const current = prev[username] ?? [];
      const next = current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission];
      return { ...prev, [username]: next };
    });
  };

  const isDirty = (u) => {
    const saved = [...(u.permissions ?? [])].sort().join(',');
    const draft = [...(drafts[u.username] ?? [])].sort().join(',');
    return saved !== draft;
  };

  const save = async (u) => {
    const response = await setUserPermissions(u.username, drafts[u.username] ?? [], token);
    if (response.success) {
      setUsers((prev) =>
        prev.map((x) => (x.username === u.username ? { ...x, permissions: response.data.permissions } : x))
      );
      setStatus({ type: 'success', message: `Updated permissions for ${u.username}` });
    } else {
      setStatus({ type: 'error', message: response.message });
    }
  };

  return (
    <div className="admin-users-container">
      <h1 className="admin-users-title">User Permissions</h1>

      {status.message && (
        <div role={status.type === 'error' ? 'alert' : 'status'} className={`admin-users-message ${status.type}`}>
          {status.message}
        </div>
      )}

      {loading ? (
        <p>Loading users…</p>
      ) : (
        <div className="admin-users-table-wrapper">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                {available.map((p) => (
                  <th key={p.name} title={p.description || undefined}>
                    {p.name}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.username === currentUser?.username;
                return (
                  <tr key={u.username}>
                    <td>{u.username}</td>
                    {available.map(({ name }) => (
                      <td key={name}>
                        <input
                          type="checkbox"
                          aria-label={`${name} for ${u.username}`}
                          checked={(drafts[u.username] ?? []).includes(name)}
                          // The API refuses self-demotion; mirror that in the UI.
                          disabled={isSelf && name === 'ADMIN'}
                          onChange={() => toggle(u.username, name)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="admin-users-save"
                        disabled={!isDirty(u)}
                        onClick={() => save(u)}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="admin-users-subtitle">Permissions</h2>
      <ul className="admin-permissions-list">
        {available.map((p) => (
          <li key={p.name}>
            <strong>{p.name}</strong>
            {p.description && <span className="admin-permission-desc"> — {p.description}</span>}
            {p.name !== 'ADMIN' && (
              <button
                type="button"
                className="admin-users-save"
                onClick={() => removePermission(p.name)}
                onBlur={() => setPendingDelete(null)}
              >
                {pendingDelete === p.name ? 'Confirm delete' : `Delete ${p.name}`}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form className="admin-permission-form" onSubmit={addPermission}>
        <input
          aria-label="New permission name"
          placeholder="NAME (e.g. RADARR)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          aria-label="New permission description"
          placeholder="Description (optional)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />
        <button type="submit" className="admin-users-save" disabled={!newName.trim()}>
          Add permission
        </button>
      </form>
    </div>
  );
}

export default AdminUsers;
