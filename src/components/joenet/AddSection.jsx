import React, { useState } from 'react';
import { useJoenetApi, useJoenetResource } from '../../hooks/useJoenetApi';
import { JOENET_APPS } from '../../services/joenetService';
import JoenetState from './JoenetState.jsx';

function AddSection({ app }) {
  const config = JOENET_APPS[app];
  const { call } = useJoenetApi(app);
  const profiles = useJoenetResource(app, 'qualityprofile');
  const folders = useJoenetResource(app, 'rootfolder');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [profileId, setProfileId] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Default the pickers to the first option once their lists load.
  const qualityProfileId = profileId || String(profiles.data?.[0]?.id ?? '');
  const rootFolderPath = folderPath || folders.data?.[0]?.path || '';

  const search = async (event) => {
    event.preventDefault();
    const result = await call(`${config.itemPath}/lookup`, { query: { term: term.trim() } });
    if (result.success) {
      setResults(result.data);
      setMessage({ type: '', text: '' });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const add = async (found) => {
    const result = await call(config.itemPath, {
      method: 'POST',
      body: config.addPayload(found, { qualityProfileId: Number(qualityProfileId), rootFolderPath }),
    });
    if (result.success) {
      setResults((prev) => prev.map((r) => (r === found ? { ...r, id: result.data.id } : r)));
      setMessage({ type: 'success', text: `Added ${found.title}` });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  return (
    <div>
      <JoenetState
        loading={profiles.loading || folders.loading}
        error={profiles.error || folders.error}
        onRetry={() => {
          profiles.reload();
          folders.reload();
        }}
      >
        <div className="joenet-form">
          <select
            aria-label="Quality profile"
            value={qualityProfileId}
            onChange={(e) => setProfileId(e.target.value)}
          >
            {(profiles.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label="Root folder" value={rootFolderPath} onChange={(e) => setFolderPath(e.target.value)}>
            {(folders.data ?? []).map((f) => (
              <option key={f.id} value={f.path}>
                {f.path}
              </option>
            ))}
          </select>
        </div>
      </JoenetState>

      <form className="joenet-form" onSubmit={search}>
        <input
          aria-label={`Search for a ${config.noun}`}
          placeholder={`Search for a ${config.noun}`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <button type="submit" className="joenet-button joenet-button--primary" disabled={!term.trim()}>
          Search
        </button>
      </form>

      {message.text && (
        <div role={message.type === 'error' ? 'alert' : 'status'} className={`joenet-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {results && results.length === 0 && <p className="joenet-muted">No results.</p>}
      <ul className="joenet-results">
        {(results ?? []).map((found) => (
          <li key={found.tmdbId ?? found.tvdbId ?? found.title} className="joenet-result">
            <div>
              <strong>{found.title}</strong> {found.year ? `(${found.year})` : ''}
              {found.overview && <p className="joenet-muted joenet-overview">{found.overview}</p>}
            </div>
            <button
              type="button"
              className="joenet-button joenet-button--primary"
              disabled={Boolean(found.id) || !qualityProfileId || !rootFolderPath}
              aria-label={`Add ${found.title}`}
              onClick={() => add(found)}
            >
              {found.id ? 'In library' : 'Add'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AddSection;
