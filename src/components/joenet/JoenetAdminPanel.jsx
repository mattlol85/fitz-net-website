import React, { useState } from 'react';
import { useJoenetKeys } from '../../contexts/JoenetKeyContext';
import { JOENET_APPS, JOENET_APP_IDS } from '../../services/joenetService';
import JoenetKeyGate from './JoenetKeyGate.jsx';
import JoenetAppPanel from './JoenetAppPanel.jsx';

/** Key gate on top; Radarr / Sonarr panels appear once at least one key is verified. */
function JoenetAdminPanel() {
  const { keys } = useJoenetKeys();
  const [selected, setSelected] = useState('radarr');
  const verified = JOENET_APP_IDS.filter((app) => keys[app]);
  // Fall back to a verified app if the selected one was forgotten.
  const active = verified.includes(selected) ? selected : verified[0];

  return (
    <>
      <JoenetKeyGate />
      {active && (
        <>
          <div className="joenet-tabs" role="tablist" aria-label="Application">
            {verified.map((app) => (
              <button
                key={app}
                type="button"
                role="tab"
                aria-selected={app === active}
                className={`joenet-tab${app === active ? ' joenet-tab--active' : ''}`}
                onClick={() => setSelected(app)}
              >
                {JOENET_APPS[app].label}
              </button>
            ))}
          </div>
          <JoenetAppPanel key={active} app={active} />
        </>
      )}
    </>
  );
}

export default JoenetAdminPanel;
