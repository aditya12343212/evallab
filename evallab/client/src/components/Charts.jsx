import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export const PALETTE = ['#4f6df5', '#e8590c', '#2f9e44', '#9c36b5', '#c2255c'];

const tip = {
  contentStyle: {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
  },
  labelStyle: { color: 'var(--text)' },
  itemStyle: { color: 'var(--text)' },
};
const axis = { stroke: 'var(--muted)', fontSize: 12 };

export function ScoreChart({ rows }) {
  const data = rows.map((r) => ({ name: r.variant, score: Number(r.avgScore.toFixed(2)) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={axis} />
        <YAxis domain={[0, 10]} tick={axis} />
        <Tooltip {...tip} cursor={{ fill: 'var(--hover)' }} />
        <Bar dataKey="score" name="Avg score (0-10)" fill={PALETTE[0]} radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LatencyChart({ rows }) {
  const data = rows.map((r) => ({
    name: r.variant,
    avg: Math.round(r.avgLatencyMs),
    p95: Math.round(r.p95LatencyMs),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={axis} />
        <YAxis tick={axis} unit=" ms" />
        <Tooltip {...tip} cursor={{ fill: 'var(--hover)' }} />
        <Legend />
        <Bar dataKey="avg" name="Average" fill={PALETTE[0]} radius={[6, 6, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="p95" name="p95 (slowest 5%)" fill={PALETTE[1]} radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ points, variants }) {
  const data = points.map((p, i) => ({ run: `#${i + 1}`, ...p.scores }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="run" tick={axis} />
        <YAxis domain={[0, 10]} tick={axis} />
        <Tooltip {...tip} />
        <Legend />
        {variants.map((v, i) => (
          <Line
            key={v}
            type="monotone"
            dataKey={v}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2.5}
            dot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
