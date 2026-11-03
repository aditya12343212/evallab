# EvalLab

Compare prompts and models with evidence, not guesses.

You give EvalLab a set of test questions with ideal answers and 2-5 prompt variants. It runs every variant on every question in parallel, scores each answer, streams the results live to a dashboard, and tells you which prompt wins, how fast and expensive it is, and whether a change made things worse than last time.

## Features

- **Parallel runs with live streaming** (Server-Sent Events), a concurrency pool, retries with backoff on 429/5xx, timeouts, and cancel
- **Two scoring modes**: LLM-as-judge with a custom rubric, or free word-overlap scoring
- **Leaderboard**: average score, pass rate, average and p95 latency, tokens, estimated cost, errors
- **Regression detection**: runs with the same name are compared automatically; a drop of 0.5 points or more (5%) is flagged, and it warns you if the test cases changed
- **Trend chart** of scores over time
- **Failure analysis**: groups failing questions and surfaces common words
- **Case explorer** with a word-level diff between any two answers (or against the reference)
- **Mock mode**: works with no API key, so anyone can try it instantly
- Works with any OpenAI-compatible API through `OPENAI_BASE_URL`

## Run it

You need Node.js 20 or newer. Open two terminals.

```bash
# Terminal 1: backend
cd server
npm install
cp .env.example .env      # optional: add OPENAI_API_KEY for real models
npm start                 # http://localhost:3001

# Terminal 2: frontend (development)
cd client
npm install
npm run dev               # http://localhost:5173
```

Single-server mode: run `npm run build` in `client`, then `npm start` in `server`. The server serves the built app at http://localhost:3001.

Run the tests: `cd server && npm test`

## Mock mode

Without `OPENAI_API_KEY` the server prints `MOCK MODE`. Answers are simulated and deterministic: a bigger "model" and a concise, precise prompt produce better answers, so the dashboard still shows a meaningful comparison. Model names starting with `mock-` always use the simulator.

## Architecture

```
client (React + Vite + Recharts)  <--- REST + Server-Sent Events --->  server (Node + Express)
                                                                          |-- runner.js    task pool, events, cancel
                                                                          |-- llm.js       OpenAI client, retries, mock provider, cost table
                                                                          |-- judge.js     LLM judge + similarity scoring
                                                                          |-- analysis.js  summaries, p95, regression, failure clusters
                                                                          |-- store.js     atomic JSON file persistence
```

API:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/runs` | start a run |
| GET | `/api/runs` | run history |
| GET | `/api/runs/:id` | one run |
| GET | `/api/runs/:id/events` | live stream (SSE) |
| POST | `/api/runs/:id/cancel` | cancel a run |
| GET | `/api/trend?name=` | scores over time |

## Known limits (be honest about these in interviews)

- Storage is a JSON file, fine for a portfolio project; swap `store.js` for PostgreSQL to scale.
- The cost table is approximate and only covers a few models; unknown models show `$0`. Edit `PRICES` in `server/src/llm.js`.
- LLM judges are imperfect and can be biased; use a clear rubric and spot-check results.
- A run that is in progress is lost if the server restarts (it is saved when it finishes).
- No login: do not expose it publicly with your API key set.

## Ideas to extend it

1. Replace the JSON file with PostgreSQL and add user accounts
2. Import test sets from CSV or JSONL
3. Add pairwise comparison (judge picks the better of two answers) to reduce score bias
4. Run each case several times and show variance
5. GitHub Action that fails a pull request when a prompt change causes a regression
6. Deploy: Docker image, backend on Render or Railway

## Resume bullet

> Built EvalLab, a full-stack LLM evaluation platform (React, Node/Express, SSE) that runs prompt variants across models in parallel, scores outputs with LLM-as-judge rubrics, and tracks quality, latency, and cost regressions over time. Includes a retrying concurrency pool, unit tests, and a mock mode for zero-cost demos.
