import { useMemo } from 'react';
import { wordDiff } from '../diff.js';

export default function DiffView({ a, b }) {
  const ops = useMemo(() => wordDiff(a.text, b.text), [a.text, b.text]);
  const identical = ops.every((o) => o.type === 'same');

  return (
    <div className="diff">
      <div className="diff-legend">
        <span className="tag del">only in {a.label}</span>
        <span className="tag add">only in {b.label}</span>
        {identical && <span className="muted">The two texts are identical.</span>}
      </div>
      <p className="diff-body">
        {ops.map((o, i) => (
          <span key={i} className={`d-${o.type}`}>
            {o.text}{' '}
          </span>
        ))}
        {ops.length === 0 && <span className="muted">(both empty)</span>}
      </p>
    </div>
  );
}
