import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const file = path.join(dir, 'runs.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

export function saveRun(run) {
  fs.mkdirSync(dir, { recursive: true });
  const runs = load();
  const i = runs.findIndex((r) => r.id === run.id);
  if (i >= 0) runs[i] = run;
  else runs.push(run);
  // write to a temp file first so a crash can't corrupt the history
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(runs, null, 2));
  fs.renameSync(tmp, file);
}

export const listRuns = () => load();
export const getRun = (id) => load().find((r) => r.id === id);
