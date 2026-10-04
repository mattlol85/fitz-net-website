import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAdminUsers, getAvailablePermissions, setUserPermissions } from '../services/api';
import '../css/AdminUsers.css';

function AdminUsers() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [available, setAvailable] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(true);

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
                  <th key={p}>{p}</th>
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
                    {available.map((p) => (
                      <td key={p}>
                        <input
                          type="checkbox"
                          aria-label={`${p} for ${u.username}`}
                          checked={(drafts[u.username] ?? []).includes(p)}
                          // The API refuses self-demotion; mirror that in the UI.
                          disabled={isSelf && p === 'ADMIN'}
                          onChange={() => toggle(u.username, p)}
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
    </div>
  );
}

export default AdminUsers;
