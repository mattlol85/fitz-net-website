import React, { useMemo } from 'react';
import { useJoenetResource } from '../../hooks/useJoenetApi';
import { JOENET_APPS, formatDate, isoDay, toRecords } from '../../services/joenetService';
import JoenetState from './JoenetState.jsx';

const DAY_MS = 86_400_000;
const MISSING_QUERY = { pageSize: '25', monitored: 'true', includeSeries: 'true' };

function ReleaseList({ title, resource, rows, empty }) {
  return (
    <>
      <h2 className="joenet-subtitle">{title}</h2>
      <JoenetState loading={resource.loading} error={resource.error} onRetry={resource.reload}>
        {rows.length === 0 ? (
          <p className="joenet-muted">{empty}</p>
        ) : (
          <ul className="joenet-list">
            {rows.map((row) => (
              <li key={row.id}>
                {row.title} <span className="joenet-muted">{formatDate(row.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </JoenetState>
    </>
  );
}

function CalendarSection({ app }) {
  const config = JOENET_APPS[app];
  // The next 30 days, computed once so the query (and the fetch) stays stable.
  const range = useMemo(() => {
    const now = Date.now();
    return { start: isoDay(new Date(now)), end: isoDay(new Date(now + 30 * DAY_MS)), includeSeries: 'true' };
  }, []);
  const calendar = useJoenetResource(app, 'calendar', range);
  const wanted = useJoenetResource(app, 'wanted/missing', MISSING_QUERY);

  return (
    <div>
      <ReleaseList
        title="Upcoming (30 days)"
        resource={calendar}
        rows={toRecords(calendar.data).map(config.calendarRow)}
        empty="Nothing scheduled."
      />
      <ReleaseList
        title="Wanted (missing)"
        resource={wanted}
        rows={toRecords(wanted.data).map(config.calendarRow)}
        empty="Nothing is missing."
      />
    </div>
  );
}

export default CalendarSection;
