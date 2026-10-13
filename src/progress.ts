// Study progress kept in this browser only: lessons marked as studied and the reader's
// own verdict on each practice problem. Nothing leaves the device.
export type Verdict = 'got-it' | 'review';
export type Progress = {
  studied: string[];
  practice: Record<string, Verdict>;
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
let snapshot: Progress = (() => {
  try {
    return parseProgress(localStorage.getItem(key));
  } catch {
    return empty;
  }
})();

function save(next: Progress) {
  snapshot = next;
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Progress still works for this visit when storage is blocked.
  }
  for (const listener of listeners) listener();
}

export const progressStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => snapshot,
  toggleStudied(id: string) {
    const has = snapshot.studied.includes(id);
    save({
      ...snapshot,
      studied: has
        ? snapshot.studied.filter((item) => item !== id)
        : [...snapshot.studied, id],
    });
  },
  setVerdict(id: string, verdict: Verdict) {
    save({ ...snapshot, practice: { ...snapshot.practice, [id]: verdict } });
  },
};

/** The first lesson in order that is not yet studied, or undefined when all are. */
export function nextUnstudied(
  order: readonly string[],
  progress: Progress,
): string | undefined {
  return order.find((id) => !progress.studied.includes(id));
}
