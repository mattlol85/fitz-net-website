import React, { useState } from 'react';
import { useJoenetApi, useJoenetResource } from '../../hooks/useJoenetApi';
import { JOENET_APPS, formatBytes } from '../../services/joenetService';
import ConfirmAction from './ConfirmAction.jsx';
import JoenetState from './JoenetState.jsx';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'monitored', label: 'Monitored' },
  { id: 'unmonitored', label: 'Unmonitored' },
];

function LibrarySection({ app }) {
  const config = JOENET_APPS[app];
  const { call } = useJoenetApi(app);
  const { data, error, loading, reload, setData } = useJoenetResource(app, config.itemPath);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const items = (data ?? []).filter((item) => {
    if (filter === 'monitored' && !item.monitored) return false;
    if (filter === 'unmonitored' && item.monitored) return false;
    return item.title.toLowerCase().includes(search.trim().toLowerCase());
  });

  const toggleMonitored = async (item) => {
    // Radarr/Sonarr expect the whole resource back on PUT.
    const result = await call(`${config.itemPath}/${item.id}`, {
      method: 'PUT',
      body: { ...item, monitored: !item.monitored },
    });
    if (result.success) {
      setData(data.map((x) => (x.id === item.id ? { ...x, monitored: !item.monitored } : x)));
      setMessage({ type: '', text: '' });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const remove = async (item) => {
    const result = await call(`${config.itemPath}/${item.id}`, {
      method: 'DELETE',
      query: { deleteFiles: String(deleteFiles) },
    });
    if (result.success) {
      setData(data.filter((x) => x.id !== item.id));
      setMessage({ type: 'success', text: `Deleted ${item.title}` });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  return (
    <div>
      <div className="joenet-form">
        <input
          aria-label={`Search ${config.noun} library`}
          placeholder="Search by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Filter by monitored" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {FILTERS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {message.text && (
        <div role={message.type === 'error' ? 'alert' : 'status'} className={`joenet-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <JoenetState loading={loading} error={error} onRetry={reload}>
        {items.length === 0 ? (
          <p className="joenet-muted">Nothing matches.</p>
        ) : (
          <div className="joenet-table-wrapper">
            <table className="joenet-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Year</th>
                  <th>Files</th>
                  <th>Size</th>
                  <th>Monitored</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.year}</td>
                    <td>{config.summary(item)}</td>
                    <td>{formatBytes(config.sizeOf(item))}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Monitored: ${item.title}`}
                        checked={Boolean(item.monitored)}
                        onChange={() => toggleMonitored(item)}
                      />
                    </td>
                    <td>
                      <ConfirmAction
                        label={`Delete ${item.title}`}
                        confirmLabel="Confirm delete"
                        onConfirm={() => remove(item)}
                      >
                        <label className="joenet-inline-check">
                          <input
                            type="checkbox"
                            checked={deleteFiles}
                            onChange={(e) => setDeleteFiles(e.target.checked)}
                          />
                          Also delete files
                        </label>
                      </ConfirmAction>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </JoenetState>
    </div>
  );
}

export default LibrarySection;
