import React, { useState } from 'react';
import StatusSection from './StatusSection.jsx';
import LibrarySection from './LibrarySection.jsx';
import ActivitySection from './ActivitySection.jsx';
import AddSection from './AddSection.jsx';
import CommandsSection from './CommandsSection.jsx';
import CalendarSection from './CalendarSection.jsx';
import SettingsSection from './SettingsSection.jsx';
import ConsoleSection from './ConsoleSection.jsx';

const SECTIONS = [
  { id: 'status', label: 'Status', Component: StatusSection },
  { id: 'library', label: 'Library', Component: LibrarySection },
  { id: 'activity', label: 'Queue & History', Component: ActivitySection },
  { id: 'add', label: 'Add', Component: AddSection },
  { id: 'commands', label: 'Commands', Component: CommandsSection },
  { id: 'calendar', label: 'Calendar & Wanted', Component: CalendarSection },
  { id: 'settings', label: 'Settings', Component: SettingsSection },
  { id: 'console', label: 'API Console', Component: ConsoleSection },
];

/** Section switcher for one app; only the open section mounts (and fetches). */
function JoenetAppPanel({ app }) {
  const [sectionId, setSectionId] = useState('status');
  const { Component } = SECTIONS.find((s) => s.id === sectionId);

  return (
    <div className="joenet-app">
      <div className="joenet-tabs joenet-tabs--sections" role="tablist" aria-label="Section">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === sectionId}
            className={`joenet-tab${id === sectionId ? ' joenet-tab--active' : ''}`}
            onClick={() => setSectionId(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="joenet-card" role="tabpanel">
        <Component app={app} />
      </section>
    </div>
  );
}

export default JoenetAppPanel;
