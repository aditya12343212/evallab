import test from 'node:test';
import assert from 'node:assert/strict';
import { similarityScore } from '../src/judge.js';
import { percentile, summarize, findRegression, casesHash } from '../src/analysis.js';
import { validate } from '../src/runner.js';

test('similarityScore: exact answer scores 10', () => {
  assert.equal(similarityScore('Canberra', 'Canberra').score, 10);
});

test('similarityScore: correct answer inside a long sentence still scores high', () => {
  const s = similarityScore('Sure! The capital of Australia is Canberra.', 'Canberra').score;
  assert.ok(s >= 8, `expected >= 8, got ${s}`);
});

test('similarityScore: wrong answer scores 0', () => {
  assert.equal(similarityScore('Sydney', 'Canberra').score, 0);
});

test('percentile', () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.equal(percentile([5], 95), 5);
  assert.equal(percentile([], 95), 0);
});

const variants = [
  { name: 'A', model: 'm' },
  { name: 'B', model: 'm' },
];
const mk = (variantIndex, score, latencyMs = 100) => ({
  variantIndex,
  caseIndex: 0,
  score,
  latencyMs,
  promptTokens: 10,
  completionTokens: 5,
  cost: 0.001,
  error: null,
});

test('summarize picks the winner and computes pass rate', () => {
  const s = summarize([mk(0, 9), mk(0, 8), mk(1, 3), mk(1, 10)], variants);
  assert.equal(s.winner, 'A');
  assert.equal(s.rows[0].passRate, 1);
  assert.equal(s.rows[1].passRate, 0.5);
  assert.ok(Math.abs(s.rows[1].cost - 0.002) < 1e-9);
});

test('findRegression flags a drop of 0.5 or more and checks comparability', () => {
  const testCases = [{ input: 'q', expected: 'a' }];
  const base = { name: 'x', status: 'done', casesHash: casesHash(testCases) };
  const prev = { ...base, id: 'p', createdAt: '2026-01-01', summary: summarize([mk(0, 9), mk(1, 8)], variants) };
  const cur = { ...base, id: 'c', createdAt: '2026-01-02', summary: summarize([mk(0, 7), mk(1, 8.2)], variants) };
  const r = findRegression(cur, [prev, cur]);
  assert.equal(r.comparable, true);
  assert.equal(r.items.find((i) => i.variant === 'A').status, 'regression');
  assert.equal(r.items.find((i) => i.variant === 'B').status, 'stable');
});

test('findRegression returns null when there is no earlier run', () => {
  const cur = { id: 'c', name: 'x', status: 'done', createdAt: '2026-01-02', summary: summarize([mk(0, 7)], variants) };
  assert.equal(findRegression(cur, [cur]), null);
});

test('validate rejects empty input and dedupes variant names', () => {
  assert.ok(validate({ testCases: [], variants: [] }).error);
  const v = validate({
    testCases: [{ input: 'hi' }],
    variants: [
      { name: 'Same', model: 'mock-small' },
      { name: 'Same', model: 'mock-small' },
    ],
  });
  assert.ok(!v.error);
  assert.notEqual(v.config.variants[0].name, v.config.variants[1].name);
});
