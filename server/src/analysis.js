// Pure functions: summaries, regression detection, failure clustering.

export const PASS_SCORE = 7;
export const FAIL_SCORE = 5;
export const REGRESSION_DELTA = 0.5; // on a 0-10 scale = 5%

export function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1);
  return s[Math.max(0, idx)];
}

export function summarize(results, variants) {
  const rows = variants.map((v, vi) => {
    const rs = results.filter((r) => r.variantIndex === vi);
    const n = rs.length;
    const sum = (f) => rs.reduce((a, r) => a + f(r), 0);
    const lat = rs.filter((r) => !r.error || r.output).map((r) => r.latencyMs);
    return {
      variant: v.name,
      model: v.model,
      count: n,
      avgScore: n ? sum((r) => r.score) / n : 0,
      passRate: n ? rs.filter((r) => r.score >= PASS_SCORE).length / n : 0,
      avgLatencyMs: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : 0,
      p95LatencyMs: percentile(lat, 95),
      tokens: sum((r) => r.promptTokens + r.completionTokens),
      cost: sum((r) => r.cost || 0),
      errors: rs.filter((r) => r.error).length,
    };
  });
  const ranked = [...rows].sort((a, b) => b.avgScore - a.avgScore);
  return { rows, winner: ranked[0]?.count ? ranked[0].variant : null };
}

const STOP = new Set(
  'the a an of to in is are was were what which who how why when where do does did for on and or with that this it as by from be at'.split(' ')
);

export function analyzeFailures(run) {
  return run.config.variants.map((v, vi) => {
    const failed = run.results.filter((r) => r.variantIndex === vi && r.score < FAIL_SCORE);
    const freq = new Map();
    for (const r of failed) {
      const words = new Set(
        run.config.testCases[r.caseIndex].input
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOP.has(w))
      );
      for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    }
    // only report a keyword as a "pattern" if it shows up in 2+ failures
    const keywords = [...freq.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));
    return {
      variant: v.name,
      failedCount: failed.length,
      keywords,
      examples: failed.slice(0, 3).map((r) => ({
        caseIndex: r.caseIndex,
        input: run.config.testCases[r.caseIndex].input,
        score: r.score,
        reason: r.reason,
      })),
    };
  });
}

export function casesHash(testCases) {
  return JSON.stringify(testCases.map((c) => [c.input, c.expected || '']));
}

/** Compare a finished run with the previous finished run that has the same name. */
export function findRegression(run, allRuns) {
  const prev = allRuns
    .filter((r) => r.name === run.name && r.id !== run.id && r.status === 'done' && r.createdAt < run.createdAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (!prev) return null;

  const items = [];
  for (const cur of run.summary.rows) {
    const old = prev.summary.rows.find((r) => r.variant === cur.variant);
    if (!old) continue;
    const delta = cur.avgScore - old.avgScore;
    items.push({
      variant: cur.variant,
      previous: old.avgScore,
      current: cur.avgScore,
      delta,
      status: delta <= -REGRESSION_DELTA ? 'regression' : delta >= REGRESSION_DELTA ? 'improved' : 'stable',
    });
  }
  if (!items.length) return null;
  return {
    previousRunId: prev.id,
    previousDate: prev.createdAt,
    comparable: prev.casesHash === run.casesHash,
    items,
  };
}
