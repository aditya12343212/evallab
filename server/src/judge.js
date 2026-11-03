import { callModel, estimateCost, getJudgeModel, hasKey } from './llm.js';

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Token-overlap score on a 0-10 scale. Short correct answers inside long text still score well. */
export function similarityScore(output, expected) {
  const o = normalize(output);
  const e = normalize(expected);
  if (!e.length) return { score: 5, reason: 'No reference answer given, neutral score.' };
  if (!o.length) return { score: 0, reason: 'Empty output.' };

  const counts = new Map();
  for (const w of e) counts.set(w, (counts.get(w) || 0) + 1);
  let overlap = 0;
  for (const w of o) {
    if (counts.get(w) > 0) {
      overlap++;
      counts.set(w, counts.get(w) - 1);
    }
  }
  if (overlap === 0) return { score: 0, reason: 'No words in common with the reference answer.' };

  const precision = overlap / o.length;
  const recall = overlap / e.length;
  const f1 = (2 * precision * recall) / (precision + recall);
  const score = Math.round(Math.max(f1, 0.9 * recall) * 100) / 10;
  return {
    score,
    reason: `Token overlap: recall ${(recall * 100).toFixed(0)}%, precision ${(precision * 100).toFixed(0)}%.`,
  };
}

const DEFAULT_RUBRIC =
  'Score 10 if the answer is correct and matches the reference in meaning. Deduct points for factual errors, missing key facts, or irrelevant extra content.';

/** Returns { score (0-10), reason, cost } */
export async function judge({ mode, model, rubric, input, expected, output }) {
  if (mode !== 'llm' || !hasKey()) {
    const r = similarityScore(output, expected);
    if (mode === 'llm') r.reason = '(mock judge) ' + r.reason;
    return { ...r, cost: 0 };
  }

  const judgeModel = model || getJudgeModel();
  const prompt = [
    'You are a strict, fair evaluator of AI answers.',
    `Rubric: ${rubric || DEFAULT_RUBRIC}`,
    '',
    `Question: ${input}`,
    expected ? `Reference answer: ${expected}` : 'Reference answer: (none provided - judge on correctness and helpfulness)',
    `Candidate answer: ${output || '(empty)'}`,
    '',
    'Respond ONLY with JSON: {"score": <number from 0 to 10>, "reason": "<one short sentence>"}',
  ].join('\n');

  const r = await callModel({ model: judgeModel, messages: [{ role: 'user', content: prompt }], json: true });
  const cost = estimateCost(judgeModel, r.promptTokens, r.completionTokens);

  let parsed;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    const m = r.text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }
  const score = Number(parsed?.score);
  if (!Number.isFinite(score)) throw new Error('Judge returned an invalid score');
  return {
    score: Math.min(10, Math.max(0, score)),
    reason: String(parsed.reason || '').slice(0, 300),
    cost,
  };
}
