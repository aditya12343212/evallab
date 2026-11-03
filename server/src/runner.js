import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { callModel, estimateCost } from './llm.js';
import { judge } from './judge.js';
import { saveRun, listRuns } from './store.js';
import { summarize, analyzeFailures, findRegression, casesHash } from './analysis.js';

const MAX_TASKS = 1000;
const live = new Map(); // runId -> { run, emitter, cancelled }

export const getLive = (id) => live.get(id);

export function cancelRun(id) {
  const entry = live.get(id);
  if (!entry) return false;
  entry.cancelled = true;
  return true;
}

/** Validate and normalise the request body. Returns { config } or { error }. */
export function validate(body = {}) {
  const str = (v, d = '') => (typeof v === 'string' ? v : d);

  const testCases = Array.isArray(body.testCases)
    ? body.testCases
        .map((c) => ({ input: str(c?.input).trim(), expected: str(c?.expected).trim() }))
        .filter((c) => c.input)
    : [];
  if (!testCases.length) return { error: 'Add at least one test case with a question.' };
  if (testCases.length > 200) return { error: 'Maximum 200 test cases per run.' };

  if (!Array.isArray(body.variants) || !body.variants.length) return { error: 'Add at least one prompt variant.' };
  if (body.variants.length > 5) return { error: 'Maximum 5 variants per run.' };

  const used = new Set();
  const variants = [];
  for (const [i, v] of body.variants.entries()) {
    const model = str(v?.model).trim();
    if (!model) return { error: `Variant ${i + 1} needs a model name.` };
    let name = str(v?.name).trim() || `Variant ${i + 1}`;
    while (used.has(name)) name += ` (${i + 1})`;
    used.add(name);
    const template = str(v?.template).trim() || '{{input}}';
    variants.push({ name, model, systemPrompt: str(v?.systemPrompt).trim(), template });
  }

  if (variants.length * testCases.length > MAX_TASKS) {
    return { error: `Too many calls (${variants.length * testCases.length}). Limit is ${MAX_TASKS} per run.` };
  }

  const j = body.judge || {};
  const config = {
    testCases,
    variants,
    judge: {
      mode: j.mode === 'similarity' ? 'similarity' : 'llm',
      model: str(j.model).trim(),
      rubric: str(j.rubric).trim(),
    },
    concurrency: Math.min(10, Math.max(1, parseInt(body.concurrency, 10) || 4)),
  };
  return { config, name: str(body.name).trim().slice(0, 80) || 'Untitled eval' };
}

export function startRun({ config, name }) {
  const run = {
    id: randomUUID().slice(0, 8),
    name,
    createdAt: new Date().toISOString(),
    status: 'running',
    config,
    total: config.variants.length * config.testCases.length,
    casesHash: casesHash(config.testCases),
    results: [],
    judgeCost: 0,
    summary: null,
    failures: null,
    regression: null,
  };
  const entry = { run, emitter: new EventEmitter(), cancelled: false };
  live.set(run.id, entry);
  execute(entry).catch((e) => {
    console.error('Run crashed:', e);
    finish(entry, 'failed');
  });
  return run;
}

async function pool(tasks, size, worker, shouldStop) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, tasks.length) }, async () => {
    while (next < tasks.length && !shouldStop()) {
      await worker(tasks[next++]);
    }
  });
  await Promise.all(lanes);
}

async function execute(entry) {
  const { run, emitter } = entry;
  const { config } = run;

  const tasks = [];
  config.variants.forEach((_, vi) => config.testCases.forEach((_, ci) => tasks.push({ vi, ci })));
  let done = 0;

  await pool(
    tasks,
    config.concurrency,
    async ({ vi, ci }) => {
      const v = config.variants[vi];
      const c = config.testCases[ci];
      const result = {
        variantIndex: vi,
        caseIndex: ci,
        variant: v.name,
        output: '',
        error: null,
        score: 0,
        reason: '',
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
      };

      try {
        const messages = [];
        if (v.systemPrompt) messages.push({ role: 'system', content: v.systemPrompt });
        messages.push({ role: 'user', content: v.template.split('{{input}}').join(c.input) });

        const r = await callModel({
          model: v.model,
          messages,
          mock: { hint: c.expected, seedKey: `${v.name}|${c.input}`, system: v.systemPrompt },
        });
        Object.assign(result, {
          output: r.text,
          latencyMs: r.latencyMs,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
          cost: estimateCost(v.model, r.promptTokens, r.completionTokens),
        });

        try {
          const j = await judge({ ...config.judge, input: c.input, expected: c.expected, output: r.text });
          result.score = j.score;
          result.reason = j.reason;
          run.judgeCost += j.cost || 0;
        } catch (e) {
          result.error = `Judge failed: ${e.message}`;
          result.reason = result.error;
        }
      } catch (e) {
        result.error = e.message;
        result.reason = 'Model call failed';
      }

      run.results.push(result);
      done++;
      emitter.emit('event', { event: 'result', data: { result, progress: { done, total: run.total } } });
    },
    () => entry.cancelled
  );

  finish(entry, entry.cancelled ? 'cancelled' : 'done');
}

function finish(entry, status) {
  const { run, emitter } = entry;
  run.status = status;
  run.finishedAt = new Date().toISOString();
  run.summary = summarize(run.results, run.config.variants);
  run.failures = analyzeFailures(run);
  if (status === 'done') run.regression = findRegression(run, listRuns());
  try {
    saveRun(run);
  } catch (e) {
    console.error('Could not save run:', e);
  }
  emitter.emit('event', { event: 'done', data: run });
  live.delete(run.id);
}
