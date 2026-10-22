import React from 'react';

function PermissionCatalogue({
  available,
  pendingDelete,
  onDelete,
  onCancelDelete,
  newName,
  newDescription,
  onNameChange,
  onDescriptionChange,
  onCreate,
}) {
  return (
    <details className="admin-catalogue" open>
      <summary>Permission catalogue ({available.length})</summary>
      <ul className="admin-permissions-list">
        {available.map((p) => (
          <li key={p.name}>
            <div className="admin-permission-info">
              <strong>{p.name}</strong>
              {p.description && <span className="admin-permission-desc">{p.description}</span>}
            </div>
            {p.name !== 'ADMIN' && (
              <button
                type="button"
                className={`admin-btn danger${pendingDelete === p.name ? ' armed' : ''}`}
                onClick={() => onDelete(p.name)}
                onBlur={onCancelDelete}
              >
                {pendingDelete === p.name ? 'Confirm delete' : `Delete ${p.name}`}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form className="admin-permission-form" onSubmit={onCreate}>
        <input
          className="admin-input"
          aria-label="New permission name"
          placeholder="NAME (e.g. RADARR)"
          value={newName}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <input
          className="admin-input grow"
          aria-label="New permission description"
          placeholder="Description (optional)"
          value={newDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
        <button type="submit" className="admin-btn primary" disabled={!newName.trim()}>
          Add permission
        </button>
      </form>
    </details>
  );
}

export default PermissionCatalogue;
