import { useState } from 'react';
import { api } from '../api.js';

const SAMPLE_CASES = [
  { input: 'What is the capital of Australia?', expected: 'Canberra' },
  { input: 'Who wrote the play Hamlet?', expected: 'William Shakespeare' },
  { input: 'What is the chemical symbol for gold?', expected: 'Au' },
  { input: 'How many continents are there?', expected: 'Seven' },
  { input: 'What is the largest planet in our solar system?', expected: 'Jupiter' },
  { input: 'In what year did World War II end?', expected: '1945' },
  { input: 'What is the square root of 144?', expected: '12' },
  { input: 'Which gas do plants absorb for photosynthesis?', expected: 'Carbon dioxide' },
];

const MODELS = ['mock-small', 'mock-large', 'gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4.1'];

export default function NewEval({ health, onStarted }) {
  const model = health.defaultModel;
  const [name, setName] = useState('Quick facts QA');
  const [cases, setCases] = useState(SAMPLE_CASES);
  const [variants, setVariants] = useState([
    { name: 'Baseline', model, systemPrompt: 'You are a helpful assistant.', template: '{{input}}' },
    {
      name: 'Concise expert',
      model,
      systemPrompt: 'You are a precise expert. Answer concisely with only the key fact.',
      template: '{{input}}',
    },
  ]);
  const [judgeMode, setJudgeMode] = useState('llm');
  const [judgeModel, setJudgeModel] = useState('');
  const [rubric, setRubric] = useState('');
  const [concurrency, setConcurrency] = useState(4);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setCase = (i, patch) => setCases((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const setVariant = (i, patch) => setVariants((vs) => vs.map((v, k) => (k === i ? { ...v, ...patch } : v)));

  function applyBulk() {
    const parsed = bulk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [input, ...rest] = l.split('|||');
        return { input: input.trim(), expected: rest.join('|||').trim() };
      })
      .filter((c) => c.input);
    if (!parsed.length) return;
    setCases((cs) => [...cs.filter((c) => c.input.trim() || c.expected.trim()), ...parsed]);
    setBulk('');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { id } = await api.startRun({
        name,
        testCases: cases,
        variants,
        judge: { mode: judgeMode, model: judgeModel, rubric },
        concurrency,
      });
      onStarted(id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const validCases = cases.filter((c) => c.input.trim()).length;
  const calls = validCases * variants.length;

  return (
    <form onSubmit={submit} className="stack">
      <section className="panel">
        <h2>1. Name this evaluation</h2>
        <p className="muted small">
          Runs with the same name are compared over time, so you can spot when a prompt change makes things worse.
        </p>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Evaluation name" />
      </section>

      <section className="panel">
        <h2>2. Prompt variants to compare</h2>
        <div className="grid-variants">
          {variants.map((v, i) => (
            <div className="card" key={i}>
              <label>
                Name
                <input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} />
              </label>
              <label>
                Model
                <input list="models" value={v.model} onChange={(e) => setVariant(i, { model: e.target.value })} />
              </label>
              <label>
                System prompt
                <textarea rows={4} value={v.systemPrompt} onChange={(e) => setVariant(i, { systemPrompt: e.target.value })} />
              </label>
              <label>
                User message template <span className="muted small">(use {'{{input}}'} for the question)</span>
                <input value={v.template} onChange={(e) => setVariant(i, { template: e.target.value })} />
              </label>
              <div className="row">
                <button
                  type="button"
                  className="ghost"
                  disabled={variants.length >= 5}
                  onClick={() => setVariants((vs) => [...vs, { ...v, name: `${v.name} copy` }])}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="ghost danger"
                  disabled={variants.length <= 1}
                  onClick={() => setVariants((vs) => vs.filter((_, k) => k !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <datalist id="models">
          {MODELS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <button
          type="button"
          className="ghost"
          disabled={variants.length >= 5}
          onClick={() =>
            setVariants((vs) => [...vs, { name: `Variant ${vs.length + 1}`, model, systemPrompt: '', template: '{{input}}' }])
          }
        >
          + Add variant
        </button>
      </section>

      <section className="panel">
        <h2>3. Test cases</h2>
        <p className="muted small">A question plus the ideal answer. The more cases, the more reliable the comparison.</p>
        <div className="cases">
          {cases.map((c, i) => (
            <div className="case-row" key={i}>
              <input
                placeholder="Question"
                aria-label={`Question ${i + 1}`}
                value={c.input}
                onChange={(e) => setCase(i, { input: e.target.value })}
              />
              <input
                placeholder="Ideal answer"
                aria-label={`Ideal answer ${i + 1}`}
                value={c.expected}
                onChange={(e) => setCase(i, { expected: e.target.value })}
              />
              <button
                type="button"
                className="ghost danger"
                aria-label={`Remove case ${i + 1}`}
                onClick={() => setCases((cs) => cs.filter((_, k) => k !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={() => setCases((cs) => [...cs, { input: '', expected: '' }])}>
            + Add case
          </button>
        </div>
        <details>
          <summary>Bulk paste (one per line: question ||| ideal answer)</summary>
          <textarea
            rows={5}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'What is 2+2? ||| 4\nCapital of France? ||| Paris'}
          />
          <button type="button" className="ghost" onClick={applyBulk}>
            Add these cases
          </button>
        </details>
      </section>

      <section className="panel">
        <h2>4. How to score answers</h2>
        <div className="row wrap">
          <label>
            Scoring method
            <select value={judgeMode} onChange={(e) => setJudgeMode(e.target.value)}>
              <option value="llm">LLM judge (a model grades each answer)</option>
              <option value="similarity">Word overlap (free, no API)</option>
            </select>
          </label>
          <label>
            Parallel calls
            <input type="number" min={1} max={10} value={concurrency} onChange={(e) => setConcurrency(e.target.value)} />
          </label>
        </div>
        {judgeMode === 'llm' && (
          <>
            {health.mock && (
              <p className="notice">
                No API key on the server, so the LLM judge falls back to word-overlap scoring. Add OPENAI_API_KEY to use a real judge.
              </p>
            )}
            <label>
              Judge model <span className="muted small">(blank = server default: {health.judgeModel})</span>
              <input list="models" value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)} />
            </label>
            <label>
              Grading rubric <span className="muted small">(optional)</span>
              <textarea
                rows={3}
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder="e.g. Score 10 only if the answer is factually correct and under 20 words."
              />
            </label>
          </>
        )}
      </section>

      {error && (
        <p className="notice bad" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" disabled={busy || !calls}>
          {busy ? 'Starting…' : `Run evaluation (${calls} model calls)`}
        </button>
      </div>
    </form>
  );
}
