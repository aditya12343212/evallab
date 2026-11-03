import { useEffect, useState } from 'react';
import { api } from './api.js';
import NewEval from './components/NewEval.jsx';
import RunView from './components/RunView.jsx';
import History from './components/History.jsx';

function parseHash() {
  const m = location.hash.match(/^#\/run\/([\w-]+)/);
  if (m) return { view: 'run', id: m[1] };
  if (location.hash === '#/history') return { view: 'history' };
  return { view: 'new' };
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() =>
      setError('Cannot reach the EvalLab server. Start it with: cd server && npm start')
    );
  }, []);

  const tab = (hash, label, active) => (
    <a href={hash} className={`tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      {label}
    </a>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">◆</span> EvalLab
          <span className="muted small tagline">Compare prompts and models with evidence</span>
        </div>
        <nav>
          {tab('#/', 'New evaluation', route.view === 'new')}
          {tab('#/history', 'History', route.view === 'history')}
        </nav>
        {health?.mock && <span className="badge mock" title="No OPENAI_API_KEY set on the server">Mock mode</span>}
      </header>

      <main>
        {error && <p className="notice bad">{error}</p>}
        {!error && !health && <p className="muted">Connecting to server…</p>}
        {health && route.view === 'new' && (
          <NewEval health={health} onStarted={(id) => (location.hash = `#/run/${id}`)} />
        )}
        {health && route.view === 'run' && <RunView runId={route.id} />}
        {health && route.view === 'history' && <History />}
      </main>
    </div>
  );
}
