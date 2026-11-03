const MAX_WORDS = 400;

/** Word-level diff using longest common subsequence. Returns [{type:'same'|'add'|'del', text}]. */
export function wordDiff(a = '', b = '') {
  const x = a.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const y = b.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const n = x.length;
  const m = y.length;

  // dp[i][j] = LCS length of x[i:], y[j:]
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      ops.push({ type: 'same', text: x[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', text: x[i++] });
    } else {
      ops.push({ type: 'add', text: y[j++] });
    }
  }
  while (i < n) ops.push({ type: 'del', text: x[i++] });
  while (j < m) ops.push({ type: 'add', text: y[j++] });
  return ops;
}
