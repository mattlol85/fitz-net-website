import React from 'react';
import { useJoenetResource } from '../../hooks/useJoenetApi';
import JoenetState from './JoenetState.jsx';

function ReadOnlyList({ title, app, path, label }) {
  const resource = useJoenetResource(app, path);
  return (
    <>
      <h2 className="joenet-subtitle">{title}</h2>
      <JoenetState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
        {resource.data?.length ? (
          <ul className="joenet-list">
            {resource.data.map((entry) => (
              <li key={entry.id}>{label(entry)}</li>
            ))}
          </ul>
        ) : (
          <p className="joenet-muted">None configured.</p>
        )}
      </JoenetState>
    </>
  );
}

/** Read-only view of the settings the Add form depends on. */
function SettingsSection({ app }) {
  return (
    <div>
      <ReadOnlyList title="Quality profiles" app={app} path="qualityprofile" label={(p) => p.name} />
      <ReadOnlyList title="Root folders" app={app} path="rootfolder" label={(f) => f.path} />
      <ReadOnlyList title="Tags" app={app} path="tag" label={(t) => t.label} />
    </div>
  );
}

export default SettingsSection;
