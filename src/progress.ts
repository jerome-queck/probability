import lessonIds from './content/order.json' with { type: 'json' };

export type Verdict = 'got-it' | 'review';
export type Progress = {
  studied: string[];
  practice: Record<string, Verdict>;
  /** Set when the last change could not be written to this browser's storage. */
  unsaved?: true;
};

export type LessonProgress = {
  lessonId: string;
  studied: boolean;
  verdict: Verdict | null;
  reviewedAt: number | null;
  revision: number;
};
type Intent =
  | { field: 'studied'; value: boolean }
  | { field: 'verdict'; value: Verdict | null };
export type ProgressMutation = Intent & {
  lessonId: string;
  expectedOwner: string;
  expectedRevision: number;
  mutationId: string;
};
type PendingState = 'queued' | 'saving' | 'error' | 'conflict';
export type SaveState =
  | 'guest'
  | 'loading'
  | 'saved'
  | 'saving'
  | 'error'
  | 'conflict';
export type GuestImportPreview = {
  owner: string | null;
  studied: number;
  verdicts: number;
  preservedVerdicts: number;
  stamp: string;
};
export type AccountSnapshot =
  | { kind: 'guest' | 'loading' | 'unavailable'; message: string }
  | {
      kind: 'account';
      owner: string;
      status: 'saved' | 'saving' | 'error' | 'conflict';
      message: string;
      records: readonly LessonProgress[];
      pending: readonly {
        lessonId: string;
        status: Exclude<SaveState, 'guest' | 'loading' | 'saved'>;
      }[];
    };

type Pending = {
  intent: Intent;
  source: 'edit' | 'import';
  command: ProgressMutation | null;
  status: PendingState;
};
type AccountData = {
  owner: string;
  records: Map<string, LessonProgress>;
  pending: Map<string, Pending[]>;
  running: Map<string, Promise<void>>;
  notice: string;
};
type Session =
  | { kind: 'guest' | 'loading' | 'unavailable'; message: string }
  | { kind: 'account'; data: AccountData };

const key = 'probability.progress.v1';
const empty: Progress = { studied: [], practice: {} };
const knownLessons = new Set(lessonIds);

export function parseProgress(raw: string | null): Progress {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return empty;
    const studied =
      'studied' in value && Array.isArray(value.studied)
        ? value.studied.filter((id): id is string => typeof id === 'string')
        : [];
    const entries =
      'practice' in value &&
      value.practice &&
      typeof value.practice === 'object'
        ? Object.entries(value.practice)
        : [];
    const practice = Object.fromEntries(
      entries.filter(
        (entry): entry is [string, Verdict] =>
          entry[1] === 'got-it' || entry[1] === 'review',
      ),
    );
    return { studied: [...new Set(studied)], practice };
  } catch {
    return empty;
  }
}

type Listener = () => void;

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

function parseRecord(value: unknown): LessonProgress {
  if (
    !value ||
    typeof value !== 'object' ||
    !('lessonId' in value) ||
    typeof value.lessonId !== 'string' ||
    !knownLessons.has(value.lessonId) ||
    !('studied' in value) ||
    typeof value.studied !== 'boolean' ||
    !('verdict' in value) ||
    (value.verdict !== null &&
      value.verdict !== 'got-it' &&
      value.verdict !== 'review') ||
    !('reviewedAt' in value) ||
    (value.reviewedAt !== null &&
      (typeof value.reviewedAt !== 'number' ||
        !Number.isSafeInteger(value.reviewedAt) ||
        value.reviewedAt < 0)) ||
    (value.verdict === null) !== (value.reviewedAt === null) ||
    !('revision' in value) ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  )
    throw new Error('Invalid progress response.');
  return {
    lessonId: value.lessonId,
    studied: value.studied,
    verdict: value.verdict,
    reviewedAt: value.reviewedAt,
    revision: value.revision,
  };
}

function parseAccount(value: unknown): string | null {
  if (value && typeof value === 'object' && 'kind' in value) {
    if (value.kind === 'guest') return null;
    if (
      value.kind === 'account' &&
      'owner' in value &&
      typeof value.owner === 'string' &&
      value.owner.length > 0
    )
      return value.owner;
  }
  throw new Error('Invalid account response.');
}

function parseRecords(value: unknown, owner: string) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('owner' in value) ||
    value.owner !== owner ||
    !('records' in value) ||
    !Array.isArray(value.records) ||
    value.records.length > knownLessons.size
  )
    throw new Error('Invalid progress response.');
  const records = new Map<string, LessonProgress>();
  for (const item of value.records) {
    const row = parseRecord(item);
    if (records.has(row.lessonId) || row.revision === 0)
      throw new Error('Invalid progress response.');
    records.set(row.lessonId, row);
  }
  return records;
}

function defaultRecord(lessonId: string): LessonProgress {
  return {
    lessonId,
    studied: false,
    verdict: null,
    reviewedAt: null,
    revision: 0,
  };
}

export function createProgressStore(
  options: {
    storage?: Pick<Storage, 'getItem' | 'setItem'>;
    fetch?: typeof fetch;
  } = {},
) {
  const listeners = new Set<Listener>();
  const request =
    options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const storage = () => options.storage ?? localStorage;
  const readStored = (): Progress | null => {
    try {
      return parseProgress(storage().getItem(key));
    } catch {
      return null;
    }
  };
  let guest = readStored() ?? empty;
  let snapshot = guest;
  let session: Session = {
    kind: 'guest',
    message: 'Guest progress stays in this browser.',
  };
  let accountSnapshot: AccountSnapshot = session;
  let retainedAccount: AccountData | null = null;
  let generation = 0;
  let controller = new AbortController();
  let initialized: Promise<void> | undefined;

  function publish() {
    if (session.kind === 'account') {
      const { data } = session;
      const studied = new Set<string>();
      const practice: Record<string, Verdict> = {};
      for (const row of data.records.values()) {
        if (row.studied) studied.add(row.lessonId);
        if (row.verdict) practice[row.lessonId] = row.verdict;
      }
      const pending = [...data.pending].flatMap(([lessonId, queue]) => {
        for (const { intent } of queue) {
          if (intent.field === 'studied') {
            if (intent.value) studied.add(lessonId);
            else studied.delete(lessonId);
          } else if (intent.value) practice[lessonId] = intent.value;
          else delete practice[lessonId];
        }
        const head = queue[0];
        return head
          ? [
              {
                lessonId,
                status:
                  head.status === 'queued' ? ('saving' as const) : head.status,
              },
            ]
          : [];
      });
      const status = pending.some((item) => item.status === 'conflict')
        ? 'conflict'
        : pending.some((item) => item.status === 'error')
          ? 'error'
          : pending.length
            ? 'saving'
            : 'saved';
      snapshot = {
        studied: [...studied],
        practice,
        ...(pending.length ? { unsaved: true as const } : {}),
      };
      accountSnapshot = {
        kind: 'account',
        owner: data.owner,
        status,
        pending,
        records: [...data.records.values()],
        message:
          data.notice ||
          (status === 'saved'
            ? 'Saved to your account.'
            : status === 'saving'
              ? 'Saving to your account.'
              : status === 'conflict'
                ? 'Another tab or device changed this lesson. Choose Retry to reapply your change, or Use account version.'
                : 'Not saved. Your changes remain in this tab. Retry when connected.'),
      };
    } else {
      accountSnapshot = session;
      snapshot = session.kind === 'guest' ? guest : { ...empty, unsaved: true };
    }
    for (const listener of listeners) listener();
  }

  function updateGuest(change: (current: Progress) => Progress) {
    const { unsaved: _, ...current } = guest.unsaved
      ? guest
      : (readStored() ?? guest);
    const next = change(current);
    try {
      storage().setItem(key, JSON.stringify(next));
      guest = next;
    } catch {
      guest = { ...next, unsaved: true };
    }
    publish();
  }

  const active = (data: AccountData, version: number) =>
    version === generation &&
    session.kind === 'account' &&
    session.data === data;

  async function loadSession() {
    const version = ++generation;
    controller.abort();
    controller = new AbortController();
    const signal = controller.signal;
    for (const queue of retainedAccount?.pending.values() ?? [])
      if (queue[0]?.status === 'saving' || queue[0]?.status === 'queued')
        queue[0].status = 'error';
    session = {
      kind: 'loading',
      message: 'Loading account progress. Reading remains available.',
    };
    publish();
    try {
      const response = await request('/api/account', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal,
      });
      if (!response.ok) throw new Error('Account unavailable.');
      const owner = parseAccount(await response.json());
      if (version !== generation) return;
      if (!owner) {
        const discarded = !!retainedAccount?.pending.size;
        retainedAccount = null;
        guest = guest.unsaved ? guest : (readStored() ?? guest);
        session = {
          kind: 'guest',
          message: discarded
            ? 'Signed out. Unsaved account changes were discarded. Guest progress stays in this browser.'
            : 'Guest progress stays in this browser.',
        };
        publish();
        return;
      }
      const progress = await request('/api/progress', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal,
      });
      if (!progress.ok) throw new Error('Progress unavailable.');
      const records = parseRecords(await progress.json(), owner);
      if (version !== generation) return;
      const changed = retainedAccount && retainedAccount.owner !== owner;
      const data: AccountData =
        retainedAccount?.owner === owner
          ? retainedAccount
          : {
              owner,
              records,
              pending: new Map(),
              running: new Map(),
              notice: '',
            };
      data.records = records;
      data.running.clear();
      data.notice = changed
        ? 'Account changed. Unsaved changes for the previous account were discarded.'
        : '';
      retainedAccount = data;
      session = { kind: 'account', data };
      publish();
    } catch {
      if (version !== generation) return;
      session = {
        kind: 'unavailable',
        message: retainedAccount?.pending.size
          ? 'Account progress is unavailable. Unsaved account changes remain in this tab and will be lost on reload. Retry to check your account.'
          : 'Account progress is unavailable. Reading remains available. Retry to check your account. No changes were saved to guest progress.',
      };
      publish();
    }
  }

  async function confirmAccount(data: AccountData, version: number) {
    const response = await request('/api/account', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Account unavailable.');
    const owner = parseAccount(await response.json());
    if (!active(data, version)) return false;
    if (owner !== data.owner) {
      await loadSession();
      return false;
    }
    return true;
  }

  function importNeeded(row: LessonProgress, intent: Intent) {
    return intent.field === 'studied' ? !row.studied : row.verdict === null;
  }

  function flush(
    data: AccountData,
    lessonId: string,
    version: number,
  ): Promise<void> {
    const running = data.running.get(lessonId);
    if (running) return running;
    const task = (async () => {
      const queue = data.pending.get(lessonId);
      while (active(data, version) && queue?.[0]?.status === 'queued') {
        const item = queue[0];
        const current = data.records.get(lessonId) ?? defaultRecord(lessonId);
        if (
          !item.command &&
          item.source === 'import' &&
          !importNeeded(current, item.intent)
        ) {
          queue.shift();
          if (!queue.length) data.pending.delete(lessonId);
          publish();
          continue;
        }
        item.command ??= {
          ...item.intent,
          lessonId,
          expectedOwner: data.owner,
          expectedRevision: current.revision,
          mutationId: crypto.randomUUID(),
        };
        item.status = 'saving';
        publish();
        try {
          const response = await request('/api/progress', {
            method: 'PATCH',
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.command),
          });
          const body: unknown = await response.json();
          if (!active(data, version)) return;
          if (
            response.status === 401 ||
            (response.status === 409 &&
              body &&
              typeof body === 'object' &&
              'error' in body &&
              body.error === 'account-changed')
          ) {
            await loadSession();
            return;
          }
          if (
            (!response.ok && response.status !== 409) ||
            !body ||
            typeof body !== 'object' ||
            !('owner' in body) ||
            body.owner !== data.owner ||
            !('record' in body)
          )
            throw new Error('Save unavailable.');
          const row = parseRecord(body.record);
          if (row.lessonId !== lessonId)
            throw new Error('Invalid progress response.');
          data.records.set(lessonId, row);
          if (response.status === 409) {
            item.status = 'conflict';
            publish();
            return;
          }
          queue.shift();
          if (!queue.length) data.pending.delete(lessonId);
          publish();
        } catch {
          if (!active(data, version)) return;
          item.status = 'error';
          publish();
          return;
        }
      }
    })();
    data.running.set(lessonId, task);
    void task.finally(() => {
      if (data.running.get(lessonId) === task) data.running.delete(lessonId);
    });
    return task;
  }

  function enqueue(
    data: AccountData,
    lessonId: string,
    intent: Intent,
    source: Pending['source'] = 'edit',
  ) {
    if (!knownLessons.has(lessonId)) return Promise.resolve();
    data.notice = '';
    const queue = data.pending.get(lessonId) ?? [];
    queue.push({ intent, source, command: null, status: 'queued' });
    data.pending.set(lessonId, queue);
    publish();
    return flush(data, lessonId, generation);
  }

  function importPlan(data: AccountData) {
    const local = guest.unsaved ? guest : (readStored() ?? guest);
    const changes: { lessonId: string; intent: Intent }[] = [];
    let preservedVerdicts = 0;
    for (const lessonId of lessonIds) {
      const row = data.records.get(lessonId) ?? defaultRecord(lessonId);
      if (local.studied.includes(lessonId) && !row.studied)
        changes.push({ lessonId, intent: { field: 'studied', value: true } });
      const verdict = local.practice[lessonId];
      if (verdict) {
        if (row.verdict) preservedVerdicts++;
        else
          changes.push({
            lessonId,
            intent: { field: 'verdict', value: verdict },
          });
      }
    }
    return { changes, preservedVerdicts };
  }

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    getAccountSnapshot: () => accountSnapshot,
    hasPendingAccountChanges: () => !!retainedAccount?.pending.size,
    getLessonSaveState(id: string): SaveState {
      if (accountSnapshot.kind === 'account')
        return (
          accountSnapshot.pending.find((item) => item.lessonId === id)
            ?.status ?? 'saved'
        );
      return accountSnapshot.kind === 'unavailable'
        ? 'error'
        : accountSnapshot.kind;
    },
    initialize() {
      initialized ??= loadSession();
      return initialized;
    },
    refreshAccount: loadSession,
    reload() {
      const stored = readStored();
      if (stored) {
        guest = stored;
        publish();
      }
    },
    toggleStudied(id: string) {
      if (session.kind === 'guest')
        return updateGuest((current) => toggleStudiedIn(current, id));
      if (session.kind === 'account')
        return enqueue(session.data, id, {
          field: 'studied',
          value: !snapshot.studied.includes(id),
        });
    },
    setVerdict(id: string, verdict: Verdict) {
      if (session.kind === 'guest')
        return updateGuest((current) => setVerdictIn(current, id, verdict));
      if (session.kind === 'account')
        return enqueue(session.data, id, {
          field: 'verdict',
          value: snapshot.practice[id] === verdict ? null : verdict,
        });
    },
    async retry(lessonId?: string) {
      if (session.kind !== 'account') return loadSession();
      const data = session.data;
      const version = generation;
      try {
        if (!(await confirmAccount(data, version))) return;
        data.notice = '';
        const tasks: Promise<void>[] = [];
        for (const [id, queue] of data.pending) {
          if (lessonId && lessonId !== id) continue;
          const head = queue[0];
          if (!head || head.status === 'saving') continue;
          if (head.status === 'conflict') head.command = null;
          head.status = 'queued';
          tasks.push(flush(data, id, version));
        }
        await Promise.all(tasks);
        if (active(data, version)) publish();
      } catch {
        if (!active(data, version)) return;
        data.notice =
          'Could not confirm your account. Nothing was retried. Your unsaved changes remain in this tab.';
        publish();
      }
    },
    async acceptRemote(lessonId?: string) {
      if (session.kind !== 'account') return;
      const data = session.data;
      const version = generation;
      try {
        if (!(await confirmAccount(data, version))) return;
        const response = await request('/api/progress', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Progress unavailable.');
        const records = parseRecords(await response.json(), data.owner);
        if (!active(data, version)) return;
        data.records = records;
        for (const [id, queue] of data.pending)
          if ((!lessonId || lessonId === id) && queue[0]?.status !== 'saving')
            data.pending.delete(id);
        data.notice = 'Loaded the account version.';
        publish();
      } catch {
        if (!active(data, version)) return;
        data.notice =
          'Could not load the account version. Your unsaved changes remain in this tab.';
        publish();
      }
    },
    getGuestImportPreview(): GuestImportPreview {
      if (session.kind !== 'account')
        return {
          owner: null,
          studied: 0,
          verdicts: 0,
          preservedVerdicts: 0,
          stamp: '',
        };
      const plan = importPlan(session.data);
      return {
        owner: session.data.owner,
        studied: plan.changes.filter(({ intent }) => intent.field === 'studied')
          .length,
        verdicts: plan.changes.filter(
          ({ intent }) => intent.field === 'verdict',
        ).length,
        preservedVerdicts: plan.preservedVerdicts,
        stamp: JSON.stringify(plan.changes),
      };
    },
    async importGuest(preview: GuestImportPreview) {
      if (session.kind !== 'account' || session.data.pending.size) return;
      const data = session.data;
      const version = generation;
      try {
        if (!(await confirmAccount(data, version))) return;
        data.notice = '';
        const plan = importPlan(data);
        if (
          preview.owner !== data.owner ||
          preview.stamp !== JSON.stringify(plan.changes)
        ) {
          data.notice =
            'Guest or account progress changed. Preview the import again.';
          publish();
          return;
        }
        if (plan.changes.length === 0) {
          data.notice =
            'Guest progress is already included. The guest copy is unchanged.';
          publish();
          return;
        }
        await Promise.all(
          plan.changes.map(({ lessonId, intent }) =>
            enqueue(data, lessonId, intent, 'import'),
          ),
        );
      } catch {
        if (!active(data, version)) return;
        data.notice =
          'Could not confirm your account. Guest progress was not imported.';
        publish();
      }
    },
  };
}

export const progressStore = createProgressStore();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === key) progressStore.reload();
  });
  window.addEventListener('beforeunload', (event) => {
    if (!progressStore.hasPendingAccountChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

/** The first lesson in order that is not yet studied, or undefined when all are. */
export function nextUnstudied(
  order: readonly string[],
  progress: Progress,
): string | undefined {
  return order.find((id) => !progress.studied.includes(id));
}
