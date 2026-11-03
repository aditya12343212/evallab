import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startRun, getLive, cancelRun, validate } from './runner.js';
import { listRuns, getRun } from './store.js';
import { hasKey, getJudgeModel } from './llm.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mock: !hasKey(),
    judgeModel: getJudgeModel(),
    defaultModel: hasKey() ? 'gpt-4o-mini' : 'mock-small',
  });
});

// Start a run
app.post('/api/runs', (req, res) => {
  const v = validate(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const run = startRun(v);
  res.status(201).json({ id: run.id, total: run.total });
});

// List history (light version, without per-case results)
app.get('/api/runs', (_req, res) => {
  const runs = listRuns()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      status: r.status,
      total: r.total,
      variants: r.config.variants.length,
      cases: r.config.testCases.length,
      winner: r.summary?.winner ?? null,
      best: r.summary ? Math.max(0, ...r.summary.rows.map((x) => x.avgScore)) : null,
      regressed: Boolean(r.regression?.items.some((i) => i.status === 'regression')),
    }));
  res.json(runs);
});

// Average score per variant across all finished runs sharing a name
app.get('/api/trend', (req, res) => {
  const name = String(req.query.name || '');
  const points = listRuns()
    .filter((r) => r.name === name && r.status === 'done')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      scores: Object.fromEntries(r.summary.rows.map((x) => [x.variant, Number(x.avgScore.toFixed(2))])),
    }));
  res.json(points);
});

app.get('/api/runs/:id', (req, res) => {
  const live = getLive(req.params.id);
  const run = live ? live.run : getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

app.post('/api/runs/:id/cancel', (req, res) => {
  res.json({ cancelled: cancelRun(req.params.id) });
});

// Live updates via Server-Sent Events
app.get('/api/runs/:id/events', (req, res) => {
  const live = getLive(req.params.id);
  const stored = live ? null : getRun(req.params.id);
  if (!live && !stored) return res.status(404).json({ error: 'Run not found' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  if (!live) {
    send('snapshot', stored);
    send('done', stored);
    return res.end();
  }

  // snapshot first, then stream new results (same tick, so nothing is missed)
  send('snapshot', live.run);
  const onEvent = ({ event, data }) => {
    send(event, data);
    if (event === 'done') res.end();
  };
  live.emitter.on('event', onEvent);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => {
    clearInterval(ping);
    live.emitter.off('event', onEvent);
  });
});

// In production, serve the built React app from the same server
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`EvalLab server on http://localhost:${PORT}`);
  console.log(hasKey() ? 'Using OpenAI API.' : 'No OPENAI_API_KEY found: running in MOCK MODE.');
});
