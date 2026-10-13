// Study progress kept in this browser only: lessons marked as studied and the reader's
// own verdict on each practice problem. Nothing leaves the device.
export type Verdict = 'got-it' | 'review';
export type Progress = {
  studied: string[];
  practice: Record<string, Verdict>;
  /** Set when the last change could not be written to this browser's storage. */
  unsaved?: true;
};

const key = 'probability.progress.v1';
const empty: Progress = { studied: [], practice: {} };

export function parseProgress(raw: string | null): Progress {
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<Progress> | null;
    const studied = Array.isArray(value?.studied)
      ? value.studied.filter((id): id is string => typeof id === 'string')
      : [];
    const practice: Record<string, Verdict> = {};
    for (const [id, verdict] of Object.entries(value?.practice ?? {}))
      if (verdict === 'got-it' || verdict === 'review') practice[id] = verdict;
    return { studied: [...new Set(studied)], practice };
  } catch {
    return empty;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
function readStored(): Progress | null {
  try {
    return parseProgress(localStorage.getItem(key));
  } catch {
    return null;
  }
}
let snapshot: Progress = readStored() ?? empty;
const notify = () => {
  for (const listener of listeners) listener();
};

// Another tab changed progress: take its value so this tab never writes over it.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key !== key) return;
    snapshot = parseProgress(event.newValue);
    notify();
  });

// Read-modify-write against storage, so a change made in another tab is kept.
function update(change: (current: Progress) => Progress) {
  const { unsaved: _, ...current } = readStored() ?? snapshot;
  const next = change(current);
  try {
    localStorage.setItem(key, JSON.stringify(next));
    snapshot = next;
  } catch {
    // Storage is blocked or full: keep the change for this visit and say it was not saved.
    snapshot = { ...next, unsaved: true };
  }
  notify();
}

export function toggleStudiedIn(progress: Progress, id: string): Progress {
  return {
    ...progress,
    studied: progress.studied.includes(id)
      ? progress.studied.filter((item) => item !== id)
      : [...progress.studied, id],
  };
}

/** Choosing the verdict that is already set clears it. */
export function setVerdictIn(
  progress: Progress,
  id: string,
  verdict: Verdict,
): Progress {
  const practice = { ...progress.practice };
  if (practice[id] === verdict) delete practice[id];
  else practice[id] = verdict;
  return { ...progress, practice };
}

export const progressStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => snapshot,
  toggleStudied(id: string) {
    update((current) => toggleStudiedIn(current, id));
  },
  setVerdict(id: string, verdict: Verdict) {
    update((current) => setVerdictIn(current, id, verdict));
  },
};

/** The first lesson in order that is not yet studied, or undefined when all are. */
export function nextUnstudied(
  order: readonly string[],
  progress: Progress,
): string | undefined {
  return order.find((id) => !progress.studied.includes(id));
}
