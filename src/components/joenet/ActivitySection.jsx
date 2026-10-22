import React, { useState } from 'react';
import { useJoenetApi, useJoenetResource } from '../../hooks/useJoenetApi';
import { formatBytes, formatDate, toRecords } from '../../services/joenetService';
import ConfirmAction from './ConfirmAction.jsx';
import JoenetState from './JoenetState.jsx';

const QUEUE_QUERY = { pageSize: '50' };
const HISTORY_QUERY = { pageSize: '25', sortKey: 'date', sortDirection: 'descending' };

function ActivitySection({ app }) {
  const { call } = useJoenetApi(app);
  const queue = useJoenetResource(app, 'queue', QUEUE_QUERY);
  const history = useJoenetResource(app, 'history', HISTORY_QUERY);
  const [message, setMessage] = useState({ type: '', text: '' });

  const removeFromQueue = async (record) => {
    const result = await call(`queue/${record.id}`, {
      method: 'DELETE',
      query: { removeFromClient: 'true', blocklist: 'false' },
    });
    if (result.success) {
      queue.setData(toRecords(queue.data).filter((r) => r.id !== record.id));
      setMessage({ type: 'success', text: `Removed ${record.title} from the queue` });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const queueRecords = toRecords(queue.data);
  const historyRecords = toRecords(history.data);

  return (
    <div>
      <h2 className="joenet-subtitle">Queue</h2>
      {message.text && (
        <div role={message.type === 'error' ? 'alert' : 'status'} className={`joenet-message ${message.type}`}>
          {message.text}
        </div>
      )}
      <JoenetState loading={queue.loading} error={queue.error} onRetry={queue.reload}>
        {queueRecords.length === 0 ? (
          <p className="joenet-muted">The queue is empty.</p>
        ) : (
          <div className="joenet-table-wrapper">
            <table className="joenet-table">
              <thead>
                <tr>
                  <th>Release</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Time left</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queueRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.title}</td>
                    <td>{record.status}</td>
                    <td>
                      {formatBytes(record.size - record.sizeleft)} / {formatBytes(record.size)}
                    </td>
                    <td>{record.timeleft || '-'}</td>
                    <td>
                      <ConfirmAction
                        label={`Remove ${record.title}`}
                        confirmLabel="Confirm remove"
                        onConfirm={() => removeFromQueue(record)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </JoenetState>

      <h2 className="joenet-subtitle">History</h2>
      <JoenetState loading={history.loading} error={history.error} onRetry={history.reload}>
        {historyRecords.length === 0 ? (
          <p className="joenet-muted">No history yet.</p>
        ) : (
          <div className="joenet-table-wrapper">
            <table className="joenet-table">
              <thead>
                <tr>
                  <th>Release</th>
                  <th>Event</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {historyRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.sourceTitle}</td>
                    <td>{record.eventType}</td>
                    <td>{formatDate(record.date)}</td>
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

export default ActivitySection;
