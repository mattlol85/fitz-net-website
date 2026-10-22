import React from 'react';
import { useJoenetResource } from '../../hooks/useJoenetApi';
import { formatBytes, formatDate } from '../../services/joenetService';
import JoenetState from './JoenetState.jsx';

function StatusSection({ app }) {
  const status = useJoenetResource(app, 'system/status');
  const health = useJoenetResource(app, 'health');
  const disks = useJoenetResource(app, 'diskspace');

  return (
    <div>
      <h2 className="joenet-subtitle">System</h2>
      <JoenetState loading={status.loading} error={status.error} onRetry={status.reload}>
        <dl className="joenet-details">
          <dt>Version</dt>
          <dd>{status.data?.version}</dd>
          <dt>OS</dt>
          <dd>{status.data?.osName}</dd>
          <dt>Branch</dt>
          <dd>{status.data?.branch}</dd>
          <dt>Started</dt>
          <dd>{formatDate(status.data?.startTime)}</dd>
        </dl>
      </JoenetState>

      <h2 className="joenet-subtitle">Health</h2>
      <JoenetState loading={health.loading} error={health.error} onRetry={health.reload}>
        {health.data?.length ? (
          <ul className="joenet-list">
            {health.data.map((issue, index) => (
              <li key={index}>
                <span className={`joenet-badge joenet-badge--${issue.type === 'error' ? 'bad' : 'warn'}`}>
                  {issue.type}
                </span>{' '}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="joenet-muted">No health issues.</p>
        )}
      </JoenetState>

      <h2 className="joenet-subtitle">Disk space</h2>
      <JoenetState loading={disks.loading} error={disks.error} onRetry={disks.reload}>
        <ul className="joenet-list">
          {(disks.data ?? []).map((disk) => (
            <li key={disk.path}>
              {disk.label || disk.path}: {formatBytes(disk.freeSpace)} free of {formatBytes(disk.totalSpace)}
            </li>
          ))}
        </ul>
      </JoenetState>
    </div>
  );
}

export default StatusSection;
