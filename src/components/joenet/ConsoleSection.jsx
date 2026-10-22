import React, { useState } from 'react';
import { useJoenetApi } from '../../hooks/useJoenetApi';
import { normalizeConsolePath } from '../../services/joenetService';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

/** Escape hatch for any /api/v3 endpoint without a dedicated screen. */
function ConsoleSection({ app }) {
  const { call } = useJoenetApi(app);
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('system/status');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState(null);
  const [sending, setSending] = useState(false);

  const hasBody = method === 'POST' || method === 'PUT';

  const send = async (event) => {
    event.preventDefault();
    const target = normalizeConsolePath(path);
    let parsedBody;
    if (hasBody && body.trim()) {
      try {
        parsedBody = JSON.parse(body);
      } catch (_error) {
        setResponse({ error: 'Request body is not valid JSON.' });
        return;
      }
    }
    setSending(true);
    const result = await call(target, { method, ...(parsedBody !== undefined && { body: parsedBody }) });
    setResponse(result.success ? { status: result.status, data: result.data } : { status: result.status, error: result.message });
    setSending(false);
  };

  return (
    <div>
      <form className="joenet-console" onSubmit={send}>
        <div className="joenet-form">
          <select aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <input
            aria-label="Path"
            className="joenet-grow"
            placeholder="movie/lookup?term=alien"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <button
            type="submit"
            className="joenet-button joenet-button--primary"
            disabled={!path.trim() || sending}
          >
            Send
          </button>
        </div>
        {hasBody && (
          <textarea
            aria-label="Request body"
            rows={6}
            spellCheck={false}
            placeholder="JSON body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        )}
      </form>

      {response && (
        <div aria-label="Response">
          {response.status && <p className="joenet-muted">Status {response.status}</p>}
          {response.error ? (
            <div role="alert" className="joenet-message error">
              {response.error}
            </div>
          ) : (
            <pre className="joenet-pre">{JSON.stringify(response.data, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default ConsoleSection;
