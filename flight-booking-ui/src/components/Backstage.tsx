import { useState } from 'react';
import { usingMockApi } from '../api';
import { playDemo, usingMockVoice } from '../voice/session';
import { setState, useAppState } from '../state/store';

/** Developer drawer: data sources, scripted demo, and the live API call log. */
export function Backstage() {
  const open = useAppState((s) => s.backstageOpen);
  const log = useAppState((s) => s.apiLog);
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!open) return null;

  return (
    <div className="backstage" role="dialog" aria-label="Dev panel">
      <header>
        <strong>Dev panel</strong>
        <button className="link small" onClick={() => setState({ backstageOpen: false })}>
          Close
        </button>
      </header>
      <dl className="bs-meta">
        <dt>API</dt>
        <dd>{usingMockApi ? 'Mock (in-browser seed data)' : String(import.meta.env.VITE_API_BASE_URL)}</dd>
        <dt>Voice</dt>
        <dd>{usingMockVoice ? 'Mock agent (typed input)' : 'OneInbox web SDK'}</dd>
      </dl>
      <div className="bs-actions">
        {usingMockVoice && (
          <button className="btn primary small" onClick={() => playDemo()}>
            Play demo script
          </button>
        )}
        <button className="btn ghost small" onClick={() => location.reload()}>
          Reset demo
        </button>
      </div>
      <div className="bs-log-head">API calls ({log.length})</div>
      <ol className="bs-log">
        {log
          .slice()
          .reverse()
          .map((e) => (
            <li key={e.id} className={`bs-${e.status}`}>
              <button className="bs-row" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                <span className={`m m-${e.method}`}>{e.method}</span>
                <span className="p">{e.path}</span>
                <span className="t">{e.status === 'pending' ? '…' : e.status === 'error' ? 'ERR' : `${e.ms}ms`}</span>
              </button>
              {expanded === e.id && (
                <pre>
                  {e.body !== undefined && `// request\n${JSON.stringify(e.body, null, 2)}\n\n`}
                  {e.error ? `// error\n${e.error}` : `// response\n${JSON.stringify(e.response, null, 2)}`}
                </pre>
              )}
            </li>
          ))}
        {!log.length && <li className="muted small">No calls yet.</li>}
      </ol>
    </div>
  );
}
