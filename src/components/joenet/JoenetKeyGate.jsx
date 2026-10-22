import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useJoenetKeys } from '../../contexts/JoenetKeyContext';
import { JOENET_APPS, JOENET_APP_IDS, verifyKey } from '../../services/joenetService';

/**
 * Lets the user paste a Radarr and/or Sonarr API key. A key is verified against
 * the real service first and only saved (for this browser session) if it works.
 */
function JoenetKeyGate() {
  const { token } = useAuth();
  const { keys, saveKey, forgetKey, forgetAll } = useJoenetKeys();
  const [inputs, setInputs] = useState({});
  const [status, setStatus] = useState({});
  const [busy, setBusy] = useState('');

  const verify = async (event, app) => {
    event.preventDefault();
    setBusy(app);
    setStatus((prev) => ({ ...prev, [app]: null }));
    const result = await verifyKey(app, inputs[app] ?? '', token);
    if (result.success) {
      saveKey(app, inputs[app].trim());
      setInputs((prev) => ({ ...prev, [app]: '' }));
    } else {
      const message =
        result.status === 401 ? 'Invalid API key - not saved.' : `${result.message} Key not saved.`;
      setStatus((prev) => ({ ...prev, [app]: message }));
    }
    setBusy('');
  };

  const forget = (app) => {
    forgetKey(app);
    setStatus((prev) => ({ ...prev, [app]: null }));
  };

  return (
    <section className="joenet-card" aria-label="API keys">
      <h2 className="joenet-subtitle">API keys</h2>
      <p className="joenet-muted">
        Keys are checked against the service, kept only for this browser session, and cleared when
        you log out or close the tab.
      </p>
      {JOENET_APP_IDS.map((app) => {
        const { label } = JOENET_APPS[app];
        return (
          <div key={app} className="joenet-key-row">
            {keys[app] ? (
              <>
                <span className="joenet-badge joenet-badge--ok">{label} verified</span>
                <button type="button" className="joenet-button" onClick={() => forget(app)}>
                  Forget {label} key
                </button>
              </>
            ) : (
              <form className="joenet-form" onSubmit={(event) => verify(event, app)}>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`${label} API key`}
                  placeholder={`${label} API key`}
                  value={inputs[app] ?? ''}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [app]: e.target.value }))}
                />
                <button
                  type="submit"
                  className="joenet-button joenet-button--primary"
                  disabled={!(inputs[app] ?? '').trim() || busy === app}
                >
                  {busy === app ? 'Verifying…' : `Verify ${label}`}
                </button>
              </form>
            )}
            {status[app] && (
              <div role="alert" className="joenet-message error">
                {status[app]}
              </div>
            )}
          </div>
        );
      })}
      {Object.keys(keys).length > 0 && (
        <button type="button" className="joenet-button" onClick={forgetAll}>
          Forget keys
        </button>
      )}
    </section>
  );
}

export default JoenetKeyGate;
