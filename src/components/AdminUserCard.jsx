import React from 'react';

function AdminUserCard({ user, draft, available, isSelf, dirty, onAdd, onRemove, onSave, onDiscard }) {
  const descriptions = Object.fromEntries(available.map((p) => [p.name, p.description]));
  const granted = [...draft].sort();
  const addable = available.filter((p) => !draft.includes(p.name));

  return (
    <li className={`admin-user-card${dirty ? ' dirty' : ''}`}>
      <div className="admin-user-card-header">
        <h3 className="admin-user-name">{user.username}</h3>
        {isSelf && <span className="admin-badge">You</span>}
        {dirty && <span className="admin-badge unsaved">Unsaved changes</span>}
        <span className="admin-user-count">{granted.length} granted</span>
      </div>

      <ul className="admin-chips" aria-label={`Permissions for ${user.username}`}>
        {granted.length === 0 && <li className="admin-chips-empty">No permissions</li>}
        {granted.map((name) => (
          <li
            key={name}
            className={`admin-chip${name === 'ADMIN' ? ' admin' : ''}`}
            title={descriptions[name] || undefined}
          >
            {name}
            {/* The API refuses self-demotion; mirror that in the UI. */}
            {!(isSelf && name === 'ADMIN') && (
              <button
                type="button"
                className="admin-chip-remove"
                aria-label={`Remove ${name} from ${user.username}`}
                onClick={() => onRemove(name)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="admin-user-card-footer">
        <select
          className="admin-select"
          aria-label={`Add permission to ${user.username}`}
          value=""
          disabled={addable.length === 0}
          onChange={(e) => e.target.value && onAdd(e.target.value)}
        >
          <option value="">{addable.length === 0 ? 'All permissions granted' : '+ Add permission…'}</option>
          {addable.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="admin-actions">
          <button type="button" className="admin-btn secondary" disabled={!dirty} onClick={onDiscard}>
            Discard
          </button>
          <button type="button" className="admin-btn primary" disabled={!dirty} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </li>
  );
}

export default AdminUserCard;
