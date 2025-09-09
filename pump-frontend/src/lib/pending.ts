export type Difficulty = "easy" | "medium" | "hard" | "expert";

export interface PendingRun {
  id: string;
  server_seed: string;
  client_seed: string;
  start: number;
  end: number;
  difficulty: Difficulty;
  targets: number[];
  started_at: number; // epoch ms
}

const STORAGE_KEY = "pump_pending_runs";

function readStore(): PendingRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingRun[];
  } catch {
    return [];
  }
}

function writeStore(items: PendingRun[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function getPendingRuns(): PendingRun[] {
  return readStore();
}

export function addPendingRun(item: Omit<PendingRun, "id" | "started_at">): PendingRun {
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const pending: PendingRun = { ...item, id, started_at: Date.now() };
  const all = readStore();
  all.push(pending);
  writeStore(all);
  return pending;
}

export function removePendingRun(id: string) {
  const all = readStore();
  const next = all.filter((p) => p.id !== id);
  writeStore(next);
}

export function clearStalePending(maxAgeMs = 12 * 60 * 60 * 1000) {
  const now = Date.now();
  const all = readStore();
  const next = all.filter((p) => now - p.started_at < maxAgeMs);
  if (next.length !== all.length) writeStore(next);
}

export function findMatchingRunId(
  runs: Array<{ id: string; client_seed: string; difficulty: string; nonce_start: number; nonce_end: number }>,
  needle: { client_seed: string; difficulty: Difficulty; start: number; end: number }
): string | null {
  const match = runs.find(
    (r) =>
      r.client_seed === needle.client_seed &&
      r.difficulty === needle.difficulty &&
      r.nonce_start === needle.start &&
      r.nonce_end === needle.end
  );
  return match ? match.id : null;
}


