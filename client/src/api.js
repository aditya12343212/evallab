async function j(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText || 'Request failed');
  }
  return res.json();
}

export const api = {
  health: () => fetch('/api/health').then(j),
  startRun: (body) =>
    fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(j),
  listRuns: () => fetch('/api/runs').then(j),
  getRun: (id) => fetch(`/api/runs/${id}`).then(j),
  cancel: (id) => fetch(`/api/runs/${id}/cancel`, { method: 'POST' }).then(j),
  trend: (name) => fetch(`/api/trend?name=${encodeURIComponent(name)}`).then(j),
};

/** Subscribe to live run events (Server-Sent Events). Returns an unsubscribe function. */
export function subscribe(id, handlers) {
  const es = new EventSource(`/api/runs/${id}/events`);
  for (const ev of ['snapshot', 'result', 'done']) {
    es.addEventListener(ev, (e) => handlers[ev]?.(JSON.parse(e.data)));
  }
  es.onerror = () => handlers.error?.();
  return () => es.close();
}
