import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate } from '../stats.js';

export default function History() {
  const [runs, setRuns] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.listRuns().then(setRuns).catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="notice bad">{err}</p>;
  if (!runs) return <p className="muted">Loading…</p>;
  if (!runs.length)
    return (
      <p className="panel">
        No runs yet. <a href="#/">Start your first evaluation.</a>
      </p>
    );

  return (
    <section className="panel">
      <h2 className="nomargin">Run history</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>When</th>
              <th>Status</th>
              <th>Size</th>
              <th>Winner</th>
              <th>Best score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  {r.regressed && <span className="tag del">▼ regression</span>}
                </td>
                <td>{fmtDate(r.createdAt)}</td>
                <td>
                  <span className={`badge ${r.status}`}>{r.status}</span>
                </td>
                <td>
                  {r.variants} × {r.cases}
                </td>
                <td>{r.winner ?? '—'}</td>
                <td>{r.best != null ? r.best.toFixed(2) : '—'}</td>
                <td>
                  <a href={`#/run/${r.id}`}>Open</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
