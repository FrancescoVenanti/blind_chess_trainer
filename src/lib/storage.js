// Drill results live in localStorage so progress survives a refresh. Private
// browsing and blocked storage are expected, not exceptional: reads fall back
// to empty stats and writes are dropped.

const KEY = 'blind-chess-trainer:v1';

function readAll() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: stats are session-only */
  }
}

const EMPTY = { attempts: 0, correct: 0, best: 0, streak: 0, totalMs: 0 };

export function loadStats(drill) {
  const all = readAll();
  return { ...EMPTY, ...(all[drill] ?? {}) };
}

/** Records one answer and returns the updated stats. */
export function recordAnswer(drill, { correct, elapsedMs = 0 }) {
  const all = readAll();
  const current = { ...EMPTY, ...(all[drill] ?? {}) };
  const streak = correct ? current.streak + 1 : 0;
  const next = {
    attempts: current.attempts + 1,
    correct: current.correct + (correct ? 1 : 0),
    streak,
    best: Math.max(current.best, streak),
    totalMs: current.totalMs + elapsedMs,
  };
  all[drill] = next;
  writeAll(all);
  return next;
}

export function resetStats(drill) {
  const all = readAll();
  delete all[drill];
  writeAll(all);
  return { ...EMPTY };
}

export function accuracy(stats) {
  if (!stats.attempts) return null;
  return Math.round((stats.correct / stats.attempts) * 100);
}

export function averageSeconds(stats) {
  if (!stats.attempts) return null;
  return (stats.totalMs / stats.attempts / 1000).toFixed(1);
}

export function loadPreferences() {
  const all = readAll();
  return all.preferences ?? {};
}

export function savePreferences(preferences) {
  const all = readAll();
  all.preferences = { ...(all.preferences ?? {}), ...preferences };
  writeAll(all);
}
