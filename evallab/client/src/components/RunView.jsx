import { useEffect, useMemo, useState } from 'react';
import { api, subscribe } from '../api.js';
import { summarize, fmtMs, fmtCost, fmtPct, fmtDate, scoreClass, FAIL_SCORE } from '../stats.js';
import { ScoreChart, LatencyChart, TrendChart } from './Charts.jsx';
import DiffView from './DiffView.jsx';

export default function RunView({ runId }) {
  const [run, setRun] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [err, setErr] = useState('');
  const [trend, setTrend] = useState([]);
  const [caseIdx, setCaseIdx] = useState(0);
  const [diffA, setDiffA] = useState('v0');
  const [diffB, setDiffB] = useState('v1');

  useEffect(() => {
    setRun(null);
    setErr('');
    setTrend([]);
    setCaseIdx(0);
    let closed = false;
    const close = subscribe(runId, {
      snapshot: (r) => {
        setErr('');
        setRun(r);
        setProgress({ done: r.results.length, total: r.total });
      },
      result: ({ result, progress: p }) => {
        setRun((prev) => (prev ? { ...prev, results: [...prev.results, result] } : prev));
        setProgress(p);
      },
      done: (r) => {
        setRun(r);
        setProgress({ done: r.results.length, total: r.total });
        closed = true;
        close();
      },
      error: async () => {
        if (closed) return;
        try {
          await api.getRun(runId);
          setErr('Connection lost. Reconnecting…');
        } catch {
          setErr('This run could not be found. It may have been interrupted by a server restart.');
          closed = true;
          close();
        }
      },
    });
    return () => {
      closed = true;
      close();
    };
  }, [runId]);

  const variants = run?.config.variants ?? [];
  const rows = useMemo(() => (run ? summarize(run.results, run.config.variants) : []), [run]);
  const ranked = useMemo(() => [...rows].sort((a, b) => b.avgScore - a.avgScore), [rows]);
  const byKey = useMemo(() => {
    const m = new Map();
    run?.results.forEach((r) => m.set(`${r.variantIndex}-${r.caseIndex}`, r));
    return m;
  }, [run]);

  const finished = run && run.status !== 'running';

  useEffect(() => {
    if (run?.status === 'done') api.trend(run.name).then(setTrend).catch(() => {});
  }, [run?.status, run?.name]);

  if (err && !run) return <p className="notice bad">{err}</p>;
  if (!run) return <p className="muted">Loading run…</p>;

  const testCases = run.config.testCases;
  const sources = (ci) => [
    ...variants.map((v, vi) => ({ key: `v${vi}`, label: v.name, text: byKey.get(`${vi}-${ci}`)?.output ?? '' })),
    { key: 'ref', label: 'Reference answer', text: testCases[ci]?.expected ?? '' },
  ];
  const src = sources(caseIdx);
  const A = src.find((s) => s.key === diffA) || src[0];
  const B = src.find((s) => s.key === diffB) || src[Math.min(1, src.length - 1)];
  const trendVariants = [...new Set(trend.flatMap((p) => Object.keys(p.scores)))];
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="stack">
      <section className="panel">
        <div className="row between wrap">
          <div>
            <h2 className="nomargin">{run.name}</h2>
            <p className="muted small nomargin">
              Run {run.id} · {fmtDate(run.createdAt)} · {variants.length} variants × {testCases.length} cases
            </p>
          </div>
          <div className="row">
            <span className={`badge ${run.status}`}>{run.status}</span>
            {run.status === 'running' && (
              <button className="ghost danger" onClick={() => api.cancel(run.id)}>
                Cancel
              </button>
            )}
          </div>
        </div>
        {run.status === 'running' && (
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
            <span>
              {progress.done} / {progress.total} calls
            </span>
          </div>
        )}
        {err && <p className="notice">{err}</p>}
      </section>

      {run.regression && (
        <section className="panel">
          <h3 className="nomargin">Compared with previous run of “{run.name}”</h3>
          <p className="muted small">Previous run {run.regression.previousRunId} · {fmtDate(run.regression.previousDate)}</p>
          {!run.regression.comparable && (
            <p className="notice">The test cases changed since the previous run, so this comparison may not be fair.</p>
          )}
          <ul className="reg">
            {run.regression.items.map((i) => (
              <li key={i.variant} className={i.status}>
                <strong>{i.variant}</strong>: {i.previous.toFixed(1)} → {i.current.toFixed(1)}{' '}
                <span className="tag">
                  {i.status === 'regression'
                    ? `▼ ${Math.abs(i.delta / 10 * 100).toFixed(0)}% worse`
                    : i.status === 'improved'
                    ? `▲ ${(i.delta / 10 * 100).toFixed(0)}% better`
                    : '● stable'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h3 className="nomargin">Leaderboard</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Variant</th>
                <th>Avg score</th>
                <th>Pass rate</th>
                <th>Avg latency</th>
                <th>p95 latency</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => (
                <tr key={r.variant}>
                  <td>{i + 1}</td>
                  <td>
                    <strong>{r.variant}</strong>
                    <div className="muted small">{r.model}</div>
                    {i === 0 && finished && r.count > 0 && <span className="tag add">Best</span>}
                  </td>
                  <td>
                    <span className={`score ${scoreClass(r.avgScore)}`}>{r.avgScore.toFixed(2)}</span>
                  </td>
                  <td>{fmtPct(r.passRate)}</td>
                  <td>{fmtMs(r.avgLatencyMs)}</td>
                  <td>{fmtMs(r.p95LatencyMs)}</td>
                  <td>{r.tokens.toLocaleString()}</td>
                  <td>{fmtCost(r.cost)}</td>
                  <td>{r.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {finished && run.judgeCost > 0 && <p className="muted small">Judge cost (not included above): {fmtCost(run.judgeCost)}</p>}
        <p className="muted small">Pass = score of 7 or more out of 10. Cost is an estimate from a built-in price table.</p>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h3 className="nomargin">Average score</h3>
          <ScoreChart rows={rows} />
        </section>
        <section className="panel">
          <h3 className="nomargin">Latency</h3>
          <LatencyChart rows={rows} />
        </section>
      </div>

      {trend.length >= 2 && (
        <section className="panel">
          <h3 className="nomargin">Score over time for “{run.name}”</h3>
          <TrendChart points={trend} variants={trendVariants} />
        </section>
      )}

      {run.failures && (
        <section className="panel">
          <h3 className="nomargin">Failure analysis</h3>
          <p className="muted small">Cases scoring below {FAIL_SCORE}. A keyword is listed only if it appears in 2+ failures.</p>
          <div className="grid-variants">
            {run.failures.map((f) => (
              <div className="card" key={f.variant}>
                <strong>{f.variant}</strong>
                <p className="nomargin">
                  {f.failedCount === 0 ? 'No failed cases 🎉' : `${f.failedCount} failed case${f.failedCount > 1 ? 's' : ''}`}
                </p>
                {f.keywords.length > 0 && (
                  <p className="small">
                    Common words in failing questions: {f.keywords.map((k) => `${k.word} (${k.count})`).join(', ')}
                  </p>
                )}
                {f.examples.map((ex) => (
                  <button key={ex.caseIndex} className="link" onClick={() => setCaseIdx(ex.caseIndex)}>
                    “{ex.input}” — {ex.score.toFixed(1)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h3 className="nomargin">Case explorer</h3>
        <p className="muted small">Click a row to inspect every variant’s answer for that question.</p>
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Question</th>
                {variants.map((v) => (
                  <th key={v.name}>{v.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {testCases.map((c, ci) => (
                <tr key={ci} className={ci === caseIdx ? 'selected' : ''} onClick={() => setCaseIdx(ci)}>
                  <td>{c.input}</td>
                  {variants.map((v, vi) => {
                    const r = byKey.get(`${vi}-${ci}`);
                    return (
                      <td key={vi}>
                        {r ? <span className={`score ${scoreClass(r.score)}`}>{r.score.toFixed(1)}</span> : <span className="muted">…</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Question {caseIdx + 1}</h4>
        <p className="nomargin">
          <strong>{testCases[caseIdx].input}</strong>
        </p>
        <p className="muted small">Reference: {testCases[caseIdx].expected || '(none)'}</p>

        <div className="grid-variants">
          {variants.map((v, vi) => {
            const r = byKey.get(`${vi}-${caseIdx}`);
            return (
              <div className="card" key={vi}>
                <div className="row between">
                  <strong>{v.name}</strong>
                  {r && <span className={`score ${scoreClass(r.score)}`}>{r.score.toFixed(1)}</span>}
                </div>
                {r ? (
                  <>
                    <p className="answer">{r.output || <span className="muted">(no output)</span>}</p>
                    <p className="muted small">
                      {fmtMs(r.latencyMs)} · {r.promptTokens + r.completionTokens} tokens
                    </p>
                    <p className="small">Judge: {r.reason}</p>
                    {r.error && <p className="notice bad small">{r.error}</p>}
                  </>
                ) : (
                  <p className="muted">Waiting…</p>
                )}
              </div>
            );
          })}
        </div>

        <h4>Compare two answers</h4>
        <div className="row wrap">
          <label>
            A
            <select value={A.key} onChange={(e) => setDiffA(e.target.value)}>
              {src.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            B
            <select value={B.key} onChange={(e) => setDiffB(e.target.value)}>
              {src.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DiffView a={A} b={B} />
      </section>
    </div>
  );
}
