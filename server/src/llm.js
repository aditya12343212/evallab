// Thin LLM client: real OpenAI-compatible calls with retries, or a deterministic mock.

const BASE = () => process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

// USD per 1M tokens. Approximate - edit to match current pricing for your models.
const PRICES = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  'gpt-4.1': { in: 2, out: 8 },
  'mock-small': { in: 0.15, out: 0.6 },
  'mock-large': { in: 2.5, out: 10 },
};

export const hasKey = () => Boolean(process.env.OPENAI_API_KEY);
export const getJudgeModel = () => process.env.JUDGE_MODEL || 'gpt-4o-mini';
export const isMock = (model) => !hasKey() || String(model).startsWith('mock');

export function estimateCost(model, promptTokens, completionTokens) {
  // longest matching key wins, so "gpt-4o-mini-2024-07-18" -> "gpt-4o-mini"
  const key = Object.keys(PRICES)
    .filter((k) => String(model).startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) return 0;
  const p = PRICES[key];
  return (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function callModel({ model, messages, json = false, mock = {} }) {
  if (isMock(model)) return mockCall(model, messages, mock);

  const start = Date.now();
  let useTemp = true;
  let lastErr;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const body = { model, messages };
      if (useTemp) body.temperature = 0;
      if (json) body.response_format = { type: 'json_object' };

      const res = await fetch(`${BASE()}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} from model API`);
        await sleep(2 ** attempt * 1000 + Math.random() * 300);
        continue;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        // some newer models reject a custom temperature - retry without it
        if (useTemp && /temperature/i.test(msg)) {
          useTemp = false;
          continue;
        }
        throw new Error(msg);
      }

      return {
        text: data.choices?.[0]?.message?.content ?? '',
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError' || e.name === 'TypeError') {
        lastErr = e; // network hiccup or timeout: retry
        await sleep(2 ** attempt * 500);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Model call failed');
}

// ---------- Mock provider (deterministic, no network) ----------

function hash(s) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function mockCall(model, messages, { hint, seedKey = '', system = '' }) {
  const start = Date.now();
  const rand = rng(hash(seedKey + '|' + model));
  const large = model.includes('large');
  const small = model.includes('small');

  let q = large ? 0.9 : small ? 0.68 : 0.78;
  if (/concise|precise|expert|step/i.test(system)) q += 0.06;
  if (system.length > 60) q += 0.03;
  q = Math.min(0.98, Math.max(0.2, q));

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const words = (hint || '').split(/\s+/).filter(Boolean);
  let text;

  if (!words.length) {
    text = `Mock response to: ${lastUser.slice(0, 80)}`;
  } else if (rand() > q + 0.1) {
    text = 'I am not certain, but I think it could be something else entirely.';
  } else {
    let kept = words.filter(() => rand() < q);
    if (!kept.length) kept = [words[0]];
    text = kept.join(' ');
    // without a "be concise" style instruction the mock model rambles
    if (!/concise|precise|short/i.test(system)) text = `Sure! Great question. The answer is: ${text}`;
  }

  await sleep(120 + rand() * 300 * (large ? 1.8 : 1));

  const inChars = messages.reduce((n, m) => n + m.content.length, 0);
  return {
    text,
    promptTokens: Math.ceil(inChars / 4),
    completionTokens: Math.ceil(text.length / 4),
    latencyMs: Date.now() - start,
  };
}
