import React, { useState } from 'react';
import { useJoenetApi, useJoenetResource } from '../../hooks/useJoenetApi';
import { JOENET_APPS, formatDate } from '../../services/joenetService';
import JoenetState from './JoenetState.jsx';

function CommandsSection({ app }) {
  const config = JOENET_APPS[app];
  const { call } = useJoenetApi(app);
  const library = useJoenetResource(app, config.itemPath);
  const commands = useJoenetResource(app, 'command');
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const itemId = Number(targetId || library.data?.[0]?.id);

  const run = async (command) => {
    const body = { name: command.name, ...(command.target ? command.target(itemId) : {}) };
    const result = await call('command', { method: 'POST', body });
    if (result.success) {
      setMessage({ type: 'success', text: `Queued ${command.label}` });
      commands.reload();
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  return (
    <div>
      <div className="joenet-form">
        {config.commands
          .filter((command) => !command.target)
          .map((command) => (
            <button key={command.name} type="button" className="joenet-button" onClick={() => run(command)}>
              {command.label}
            </button>
          ))}
      </div>

      <h2 className="joenet-subtitle">Run on a {config.noun}</h2>
      <div className="joenet-form">
        <select aria-label={`Target ${config.noun}`} value={itemId || ''} onChange={(e) => setTargetId(e.target.value)}>
          {(library.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        {config.commands
          .filter((command) => command.target)
          .map((command) => (
            <button
              key={command.name}
              type="button"
              className="joenet-button"
              disabled={!itemId}
              onClick={() => run(command)}
            >
              {command.label}
            </button>
          ))}
      </div>

      {message.text && (
        <div role={message.type === 'error' ? 'alert' : 'status'} className={`joenet-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <h2 className="joenet-subtitle">Recent commands</h2>
      <JoenetState loading={commands.loading} error={commands.error} onRetry={commands.reload}>
        <ul className="joenet-list">
          {(commands.data ?? []).slice(-10).reverse().map((command) => (
            <li key={command.id}>
              {command.name} - {command.status} ({formatDate(command.queued)})
            </li>
          ))}
        </ul>
      </JoenetState>
    </div>
  );
}

export default CommandsSection;
