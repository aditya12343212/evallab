// Client-side stats so the dashboard can update live while a run is in progress.
export const PASS_SCORE = 7;
export const FAIL_SCORE = 5;

function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.max(0, Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1))];
}

export function summarize(results, variants) {
  return variants.map((v, vi) => {
    const rs = results.filter((r) => r.variantIndex === vi);
    const n = rs.length;
    const sum = (f) => rs.reduce((a, r) => a + f(r), 0);
    const lat = rs.filter((r) => r.latencyMs > 0).map((r) => r.latencyMs);
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
}

export const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
export const fmtCost = (c) => (c === 0 ? '$0' : c < 0.01 ? `$${c.toFixed(5)}` : `$${c.toFixed(3)}`);
export const fmtPct = (x) => `${Math.round(x * 100)}%`;
export const scoreClass = (s) => (s >= PASS_SCORE ? 'good' : s >= FAIL_SCORE ? 'warn' : 'bad');
export const fmtDate = (iso) => new Date(iso).toLocaleString();
