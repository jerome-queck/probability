import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { Miniflare } from 'miniflare';
import { handleAccount, handleProgress } from '../server/progress.ts';
import {
  createProgressStore,
  type LessonProgress,
  type ProgressMutation,
} from './progress.ts';

const origin = 'https://study.test';
const readJson = async (response: Response) =>
  (await response.json()) as {
    record: LessonProgress;
    records: LessonProgress[];
  };
const mutation = (
  owner: string,
  lessonId = 'F01',
  expectedRevision = 0,
): ProgressMutation => ({
  expectedOwner: owner,
  lessonId,
  expectedRevision,
  mutationId: crypto.randomUUID(),
  field: 'studied',
  value: true,
});
const patch = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${origin}/api/progress`, {
    method: 'PATCH',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

function localStorageFixture(value: object) {
  const data = new Map([['probability.progress.v1', JSON.stringify(value)]]);
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, next: string) => {
      data.set(key, next);
    },
  };
}

test('production progress handler and account store against local D1', async (t) => {
  const mf = new Miniflare({
    telemetry: { enabled: false },
    workers: [
      {
        config: {
          name: 'progress-test',
          compatibilityDate: '2026-10-01',
          manifest: {
            mainModule: 'index.js',
            modules: {
              'index.js': {
                type: 'esm',
                contents:
                  'export default { fetch() { return new Response("not used"); } };',
              },
            },
          },
          env: { DB: { type: 'd1', id: 'progress-test' } },
        },
      },
    ],
  });
  try {
    const db = await mf.getD1Database('DB');
    const migrations = new URL('../drizzle/', import.meta.url);
    for (const file of (await readdir(migrations))
      .filter((file) => file.endsWith('.sql'))
      .sort()) {
      const sql = await readFile(new URL(file, migrations), 'utf8');
      for (const statement of sql.split('--> statement-breakpoint'))
        if (statement.trim()) await db.prepare(statement).run();
    }
    const context = (owner: string | null) => ({
      db,
      user: owner ? { userId: owner } : null,
    });
    const read = (owner: string | null) =>
      handleProgress(new Request(`${origin}/api/progress`), context(owner));
    const send = (
      owner: string | null,
      body: unknown,
      headers?: Record<string, string>,
    ) => handleProgress(patch(body, headers), context(owner));
    const transport =
      (owner: () => string | null): typeof fetch =>
      async (input, init) => {
        const url = new URL(String(input), origin);
        const headers = new Headers(init?.headers);
        if (init?.method === 'PATCH') headers.set('Origin', origin);
        const request = new Request(url, { ...init, headers });
        return url.pathname === '/api/account'
          ? handleAccount(context(owner()))
          : handleProgress(request, context(owner()));
      };

    await t.test(
      'anonymous account discovery and personal endpoints never trust request identity',
      async () => {
        const guest = handleAccount(context(null));
        assert.deepEqual(await readJson(guest), { kind: 'guest' });
        assert.equal(guest.headers.get('Cache-Control'), 'no-store');
        const forged = new Request(`${origin}/api/progress`, {
          headers: {
            'oai-authenticated-user-id': 'A',
            Authorization: 'Bearer bypass-only',
          },
        });
        const response = await handleProgress(forged, context(null));
        assert.equal(response.status, 401);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal((await send(null, mutation('A'))).status, 401);
      },
    );

    await t.test(
      'owner-scoped write survives a fresh read and another owner cannot select it',
      async () => {
        const response = await send('A', mutation('A'));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        const saved = await readJson(response);
        assert.deepEqual(saved.record, {
          lessonId: 'F01',
          studied: true,
          verdict: null,
          reviewedAt: null,
          revision: 1,
        });
        assert.deepEqual((await readJson(await read('A'))).records, [
          saved.record,
        ]);
        assert.deepEqual((await readJson(await read('B'))).records, []);
        assert.equal((await send('B', mutation('A'))).status, 409);
        assert.equal(
          (await send('A', { ...mutation('A'), owner: 'B' })).status,
          400,
        );
        const row = await db
          .prepare(
            'SELECT owner, lesson_id, studied, revision FROM lesson_progress WHERE owner = ?',
          )
          .bind('A')
          .first();
        assert.deepEqual(row, {
          owner: 'A',
          lesson_id: 'F01',
          studied: 1,
          revision: 1,
        });
        assert.equal(
          (
            await db
              .prepare(
                'SELECT COUNT(*) AS n FROM lesson_progress WHERE owner = ?',
              )
              .bind('B')
              .first()
          )?.n,
          0,
        );
      },
    );

    await t.test(
      'write validation rejects foreign origin, wrong JSON, unknown IDs, malformed and oversized bodies',
      async () => {
        const command = mutation('validation');
        for (const [body, headers, status] of [
          [command, { Origin: 'https://other.test' }, 403],
          [command, { Origin: '' }, 403],
          [command, { 'Sec-Fetch-Site': 'cross-site' }, 403],
          [command, { 'Content-Type': 'text/plain' }, 415],
          [{ ...command, lessonId: 'unknown' }, {}, 400],
          [{ ...command, expectedRevision: -1 }, {}, 400],
          [{ ...command, expectedRevision: 0.5 }, {}, 400],
          [{ ...command, expectedOwner: undefined }, {}, 400],
          [{ ...command, field: 'verdict', value: 'maybe' }, {}, 400],
          [{ ...command, extra: true }, {}, 400],
          [{ ...command, mutationId: 'short' }, {}, 400],
        ] as const) {
          const response = await send('validation', body, headers);
          assert.equal(response.status, status);
          assert.equal(response.headers.get('Cache-Control'), 'no-store');
        }
        const malformed = new Request(`${origin}/api/progress`, {
          method: 'PATCH',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: '{',
        });
        assert.equal(
          (await handleProgress(malformed, context('validation'))).status,
          400,
        );
        const oversizedOptions = {
          method: 'PATCH',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('x'.repeat(2049)));
              controller.close();
            },
          }),
          duplex: 'half' as const,
        };
        const oversized = new Request(
          `${origin}/api/progress`,
          oversizedOptions,
        );
        assert.equal(
          (await handleProgress(oversized, context('validation'))).status,
          413,
        );
        assert.equal(
          (
            await db
              .prepare(
                'SELECT COUNT(*) AS n FROM lesson_progress WHERE owner = ?',
              )
              .bind('validation')
              .first()
          )?.n,
          0,
        );
        assert.equal(
          (
            await handleProgress(new Request(`${origin}/api/progress`), {
              user: { userId: 'A' },
            })
          ).status,
          503,
        );
      },
    );

    await t.test(
      'latest retry keeps revision and review time, stale distinct and historical retries conflict',
      async () => {
        const first: ProgressMutation = {
          ...mutation('retry'),
          field: 'verdict',
          value: 'review',
        };
        const a = await readJson(await send('retry', first));
        const duplicate = await readJson(await send('retry', first));
        assert.deepEqual(duplicate, a);
        assert.equal(typeof a.record.reviewedAt, 'number');
        assert.equal(
          (await send('retry', { ...first, value: 'got-it' })).status,
          409,
        );
        assert.equal((await send('retry', mutation('retry'))).status, 409);
        assert.equal(
          (
            await send('retry', {
              ...mutation('retry', 'F01', 1),
              field: 'verdict',
              value: null,
            })
          ).status,
          200,
        );
        const oldRetry = await send('retry', first);
        assert.equal(oldRetry.status, 409);
        assert.deepEqual((await readJson(oldRetry)).record, {
          lessonId: 'F01',
          studied: false,
          verdict: null,
          reviewedAt: null,
          revision: 2,
        });
      },
    );

    await t.test(
      'concurrent duplicate writes apply once, competing writes conflict, distinct rows succeed',
      async () => {
        const duplicate = mutation('concurrent-duplicate');
        const same = await Promise.all([
          send('concurrent-duplicate', duplicate),
          send('concurrent-duplicate', duplicate),
        ]);
        assert.deepEqual(
          same.map((response) => response.status),
          [200, 200],
        );
        assert.deepEqual(await readJson(same[0]), await readJson(same[1]));
        const competing = await Promise.all([
          send('concurrent', mutation('concurrent')),
          send('concurrent', { ...mutation('concurrent'), value: false }),
        ]);
        assert.deepEqual(
          competing.map((response) => response.status).sort(),
          [200, 409],
        );
        const updates = await Promise.all([
          send('concurrent', {
            ...mutation('concurrent', 'F01', 1),
            field: 'verdict',
            value: 'review',
          }),
          send('concurrent', {
            ...mutation('concurrent', 'F01', 1),
            field: 'verdict',
            value: 'got-it',
          }),
        ]);
        assert.deepEqual(
          updates.map((response) => response.status).sort(),
          [200, 409],
        );
        const distinct = await Promise.all([
          send('distinct', mutation('distinct', 'F01')),
          send('distinct', mutation('distinct', 'F02')),
          send('other-owner', mutation('other-owner', 'F01')),
        ]);
        assert.deepEqual(
          distinct.map((response) => response.status),
          [200, 200, 200],
        );
        assert.equal(
          (await readJson(await read('distinct'))).records.length,
          2,
        );
      },
    );

    await t.test(
      'explicit import unions studied, preserves account verdicts and guest data, and repeats without writes',
      async () => {
        await send('import', {
          ...mutation('import', 'F01'),
          field: 'verdict',
          value: 'got-it',
        });
        const originalReviewTime = (await readJson(await read('import')))
          .records[0].reviewedAt;
        const storage = localStorageFixture({
          studied: ['F01', 'F02', 'unknown'],
          practice: { F01: 'review', F02: 'review', unknown: 'got-it' },
        });
        const before = storage.getItem('probability.progress.v1');
        const store = createProgressStore({
          storage,
          fetch: transport(() => 'import'),
        });
        await store.initialize();
        assert.deepEqual(store.getSnapshot().studied, []);
        const preview = store.getGuestImportPreview();
        assert.deepEqual(
          {
            studied: preview.studied,
            verdicts: preview.verdicts,
            preservedVerdicts: preview.preservedVerdicts,
          },
          {
            studied: 2,
            verdicts: 1,
            preservedVerdicts: 1,
          },
        );
        await store.importGuest(preview);
        assert.deepEqual(store.getSnapshot(), {
          studied: ['F01', 'F02'],
          practice: { F01: 'got-it', F02: 'review' },
        });
        const saved = await readJson(await read('import'));
        assert.equal(saved.records[0].reviewedAt, originalReviewTime);
        await store.importGuest(store.getGuestImportPreview());
        assert.deepEqual(await readJson(await read('import')), saved);
        assert.equal(storage.getItem('probability.progress.v1'), before);
        assert.equal(store.getLessonSaveState('F02'), 'saved');
        const reloaded = createProgressStore({
          storage,
          fetch: transport(() => 'import'),
        });
        await reloaded.initialize();
        assert.deepEqual(reloaded.getSnapshot(), store.getSnapshot());
      },
    );

    await t.test(
      'a lost acknowledgement stays visibly unsaved, retry confirms identity and does not apply twice',
      async () => {
        const storage = localStorageFixture({ studied: ['F03'], practice: {} });
        const base = transport(() => 'lost-response');
        let drop = true;
        let checks = 0;
        const fetch: typeof globalThis.fetch = async (input, init) => {
          if (String(input) === '/api/account') checks++;
          const response = await base(input, init);
          if (init?.method === 'PATCH' && drop) {
            drop = false;
            throw new Error('connection lost after commit');
          }
          return response;
        };
        const store = createProgressStore({ storage, fetch });
        await store.initialize();
        await store.setVerdict('F01', 'review');
        assert.equal(store.getLessonSaveState('F01'), 'error');
        assert.equal(store.getSnapshot().unsaved, true);
        assert.deepEqual(
          JSON.parse(storage.getItem('probability.progress.v1') ?? ''),
          { studied: ['F03'], practice: {} },
        );
        const saved = await readJson(await read('lost-response'));
        await store.retry();
        assert.equal(checks, 2);
        assert.deepEqual(await readJson(await read('lost-response')), saved);
        assert.equal(store.getLessonSaveState('F01'), 'saved');
        assert.equal(store.getSnapshot().unsaved, undefined);
      },
    );

    await t.test(
      'conflicts retain intended edits and require explicit reapply or account version',
      async () => {
        const store = createProgressStore({
          storage: localStorageFixture({}),
          fetch: transport(() => 'conflict'),
        });
        await store.initialize();
        await send('conflict', mutation('conflict'));
        await store.setVerdict('F01', 'review');
        assert.equal(store.getLessonSaveState('F01'), 'conflict');
        assert.equal(
          (await readJson(await read('conflict'))).records[0].verdict,
          null,
        );
        await store.retry('F01');
        assert.equal(
          (await readJson(await read('conflict'))).records[0].verdict,
          'review',
        );
        await send('conflict', {
          ...mutation('conflict', 'F01', 2),
          field: 'verdict',
          value: 'got-it',
        });
        await store.setVerdict('F01', 'review');
        assert.equal(store.getLessonSaveState('F01'), 'conflict');
        await store.acceptRemote('F01');
        assert.deepEqual(store.getSnapshot(), {
          studied: ['F01'],
          practice: { F01: 'got-it' },
        });
        assert.equal(store.getLessonSaveState('F01'), 'saved');
      },
    );

    await t.test(
      'late A responses cannot alter B and retry checks the active account before sending',
      async () => {
        let owner: string | null = 'late-A';
        const base = transport(() => owner);
        let release: ((response: Response) => void) | undefined;
        let oldResponse: Response | undefined;
        let oldSignal: AbortSignal | null | undefined;
        let writes = 0;
        const fetch: typeof globalThis.fetch = async (input, init) => {
          if (init?.method !== 'PATCH') return base(input, init);
          writes++;
          oldSignal = init.signal;
          oldResponse = await base(input, init);
          return new Promise<Response>((resolve) => {
            release = resolve;
          });
        };
        const storage = localStorageFixture({ studied: ['F03'], practice: {} });
        const store = createProgressStore({ storage, fetch });
        await store.initialize();
        const saving = store.toggleStudied('F01');
        while (!release)
          await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(store.getLessonSaveState('F01'), 'saving');
        owner = 'late-B';
        await store.refreshAccount();
        assert.equal(oldSignal?.aborted, true);
        assert.ok(oldResponse);
        release(oldResponse);
        await saving;
        assert.deepEqual(store.getSnapshot(), { studied: [], practice: {} });
        assert.equal(store.getAccountSnapshot().kind, 'account');
        assert.deepEqual((await readJson(await read('late-B'))).records, []);
        assert.equal(writes, 1);

        owner = 'retry-A';
        let fail = true;
        const retryFetch: typeof globalThis.fetch = async (input, init) => {
          if (init?.method === 'PATCH' && fail) {
            fail = false;
            throw new Error('offline');
          }
          return base(input, init);
        };
        const retryStore = createProgressStore({ storage, fetch: retryFetch });
        await retryStore.initialize();
        await retryStore.toggleStudied('F01');
        owner = 'retry-B';
        await retryStore.retry();
        assert.deepEqual(retryStore.getSnapshot(), {
          studied: [],
          practice: {},
        });
        assert.deepEqual((await readJson(await read('retry-B'))).records, []);
        owner = null;
        await retryStore.refreshAccount();
        assert.deepEqual(retryStore.getSnapshot(), {
          studied: ['F03'],
          practice: {},
        });
      },
    );

    await t.test(
      'account discovery failure blocks account edits without a silent guest save',
      async () => {
        const storage = localStorageFixture({ studied: ['F03'], practice: {} });
        const store = createProgressStore({
          storage,
          fetch: async () => {
            throw new Error('offline');
          },
        });
        await store.initialize();
        assert.equal(store.getAccountSnapshot().kind, 'unavailable');
        assert.equal(store.getLessonSaveState('F01'), 'unavailable');
        store.toggleStudied('F01');
        assert.equal(store.getSnapshot().unsaved, true);
        assert.deepEqual(
          JSON.parse(storage.getItem('probability.progress.v1') ?? ''),
          { studied: ['F03'], practice: {} },
        );
      },
    );

    await t.test(
      'rapid account edits serialize desired states without losing either field',
      async () => {
        const store = createProgressStore({
          storage: localStorageFixture({}),
          fetch: transport(() => 'rapid'),
        });
        await store.initialize();
        const saving = store.toggleStudied('F01');
        store.setVerdict('F01', 'review');
        store.toggleStudied('F01');
        store.setVerdict('F01', 'review');
        assert.deepEqual(store.getSnapshot(), {
          studied: [],
          practice: {},
          unsaved: true,
        });
        await saving;
        assert.deepEqual((await readJson(await read('rapid'))).records, [
          {
            lessonId: 'F01',
            studied: false,
            verdict: null,
            reviewedAt: null,
            revision: 4,
          },
        ]);
        assert.deepEqual(store.getSnapshot(), { studied: [], practice: {} });
      },
    );

    await t.test(
      'partial import retries retain account verdicts established during a conflict',
      async () => {
        const base = transport(() => 'import-race');
        let race = true;
        let failOther = true;
        const fetch: typeof globalThis.fetch = async (input, init) => {
          if (init?.method === 'PATCH' && typeof init.body === 'string') {
            const body = JSON.parse(init.body);
            if (body.lessonId === 'F01' && race) {
              race = false;
              await send('import-race', {
                ...mutation('import-race'),
                field: 'verdict',
                value: 'got-it',
              });
            }
            if (body.lessonId === 'F02' && failOther) {
              failOther = false;
              throw new Error('offline');
            }
          }
          return base(input, init);
        };
        const storage = localStorageFixture({
          studied: ['F01', 'F02'],
          practice: { F01: 'review' },
        });
        const store = createProgressStore({ storage, fetch });
        await store.initialize();
        await store.importGuest(store.getGuestImportPreview());
        assert.equal(store.getLessonSaveState('F01'), 'conflict');
        assert.equal(store.getLessonSaveState('F02'), 'error');
        await store.retry();
        assert.deepEqual(store.getSnapshot(), {
          studied: ['F01', 'F02'],
          practice: { F01: 'got-it' },
        });
        const saved = await readJson(await read('import-race'));
        assert.equal(saved.records[0].revision, 2);
        await store.importGuest(store.getGuestImportPreview());
        assert.deepEqual(await readJson(await read('import-race')), saved);
        assert.deepEqual(
          JSON.parse(storage.getItem('probability.progress.v1') ?? ''),
          { studied: ['F01', 'F02'], practice: { F01: 'review' } },
        );
      },
    );

    await t.test(
      'a late account load is discarded after switching to a second owner',
      async () => {
        await send('load-A', mutation('load-A'));
        let owner = 'load-A';
        const base = transport(() => owner);
        let release: (() => void) | undefined;
        const fetch: typeof globalThis.fetch = async (input, init) => {
          const response = await base(input, init);
          if (String(input) === '/api/progress' && owner === 'load-A')
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          return response;
        };
        const store = createProgressStore({
          storage: localStorageFixture({}),
          fetch,
        });
        const loading = store.initialize();
        while (!release)
          await new Promise<void>((resolve) => setImmediate(resolve));
        owner = 'load-B';
        await store.refreshAccount();
        release();
        await loading;
        assert.deepEqual(store.getSnapshot(), { studied: [], practice: {} });
        const account = store.getAccountSnapshot();
        assert.equal(account.kind, 'account');
        assert.equal(account.kind === 'account' && account.owner, 'load-B');
      },
    );
    await t.test(
      'import refuses a stale preview even when its counts match',
      async () => {
        const storage = localStorageFixture({ studied: ['F01'], practice: {} });
        const store = createProgressStore({
          storage,
          fetch: transport(() => 'preview'),
        });
        await store.initialize();
        const preview = store.getGuestImportPreview();
        storage.setItem(
          'probability.progress.v1',
          JSON.stringify({ studied: ['F02'], practice: {} }),
        );
        await store.importGuest(preview);
        assert.deepEqual((await readJson(await read('preview'))).records, []);
        assert.match(
          store.getAccountSnapshot().message,
          /Preview the import again/,
        );
        await store.importGuest(store.getGuestImportPreview());
        assert.deepEqual(store.getSnapshot(), {
          studied: ['F02'],
          practice: {},
        });
      },
    );
    await t.test(
      'retry failure keeps its original account intent and a later save clears the error notice',
      async () => {
        const base = transport(() => 'retry-check');
        let failWrite = true;
        let failCheck = false;
        const fetch: typeof globalThis.fetch = async (input, init) => {
          if (String(input) === '/api/account' && failCheck)
            throw new Error('offline account check');
          if (init?.method === 'PATCH' && failWrite) {
            failWrite = false;
            throw new Error('offline write');
          }
          return base(input, init);
        };
        const store = createProgressStore({
          storage: localStorageFixture({}),
          fetch,
        });
        await store.initialize();
        await store.toggleStudied('F01');
        failCheck = true;
        await store.retry();
        assert.equal(store.getLessonSaveState('F01'), 'error');
        assert.equal(store.hasPendingAccountChanges(), true);
        assert.deepEqual(
          (await readJson(await read('retry-check'))).records,
          [],
        );
        failCheck = false;
        await store.retry();
        assert.equal(store.getLessonSaveState('F01'), 'saved');
        assert.equal(store.hasPendingAccountChanges(), false);
        assert.equal(
          store.getAccountSnapshot().message,
          'Saved to your account.',
        );
      },
    );
    await t.test(
      'an older account refresh preserves newer acknowledgements and unsaved intents',
      { timeout: 10000 },
      async () => {
        const owner = 'remote-refresh-race';
        const base = transport(() => owner);
        const failures = new Set(['F01']);
        let holdRead = false;
        let release = () => {};
        let captured = () => {};
        const capturedRead = new Promise<void>((resolve) => {
          captured = resolve;
        });
        const fetch: typeof globalThis.fetch = async (input, init) => {
          if (init?.method === 'PATCH') {
            const { lessonId } = JSON.parse(String(init.body));
            if (failures.has(lessonId)) throw new Error('offline write');
          }
          const response = await base(input, init);
          if (String(input) === '/api/progress' && !init?.method && holdRead) {
            holdRead = false;
            await new Promise<void>((resolve) => {
              release = resolve;
              captured();
            });
          }
          return response;
        };
        const store = createProgressStore({
          storage: localStorageFixture({}),
          fetch,
        });
        await store.initialize();
        await store.toggleStudied('F01');
        holdRead = true;
        const loading = store.acceptRemote();
        await capturedRead;
        await store.toggleStudied('F02');
        failures.add('F03');
        await store.toggleStudied('F03');
        await store.setVerdict('F01', 'review');
        failures.delete('F01');
        release();
        await loading;
        assert.deepEqual([...store.getSnapshot().studied].sort(), [
          'F02',
          'F03',
        ]);
        assert.equal(store.getSnapshot().practice.F01, 'review');
        assert.equal(store.getLessonSaveState('F02'), 'saved');
        assert.equal(store.getLessonSaveState('F03'), 'error');
        assert.equal(store.getSnapshot().unsaved, true);
        assert.match(store.getAccountSnapshot().message, /Not saved/);
        const rows = (await readJson(await read(owner))).records;
        assert.equal(rows.find((row) => row.lessonId === 'F02')?.studied, true);
        assert.equal(
          rows.find((row) => row.lessonId === 'F01')?.verdict,
          'review',
        );
        assert.equal(
          rows.find((row) => row.lessonId === 'F01')?.studied,
          false,
        );
        failures.clear();
        await store.retry();
        assert.equal(store.getLessonSaveState('F03'), 'saved');
        assert.equal(
          (await readJson(await read(owner))).records.find(
            (row) => row.lessonId === 'F03',
          )?.studied,
          true,
        );
      },
    );
    await t.test(
      'a delayed write acknowledgement cannot replace a newer confirmed revision',
      { timeout: 10000 },
      async () => {
        const owner = 'late-acknowledgement';
        const base = transport(() => owner);
        let holdCheck = false;
        let startCheck = () => {};
        let releaseCheck = () => {};
        let startAck = () => {};
        let releaseAck = () => {};
        const checking = new Promise<void>((resolve) => {
          startCheck = resolve;
        });
        const checkGate = new Promise<void>((resolve) => {
          releaseCheck = resolve;
        });
        const acknowledging = new Promise<void>((resolve) => {
          startAck = resolve;
        });
        const ackGate = new Promise<void>((resolve) => {
          releaseAck = resolve;
        });
        const fetch: typeof globalThis.fetch = async (input, init) => {
          if (String(input) === '/api/account' && holdCheck) {
            startCheck();
            await checkGate;
          }
          if (init?.method === 'PATCH') {
            const { lessonId } = JSON.parse(String(init.body));
            if (lessonId === 'F02') throw new Error('offline write');
            const response = await base(input, init);
            startAck();
            await ackGate;
            return response;
          }
          return base(input, init);
        };
        const store = createProgressStore({
          storage: localStorageFixture({}),
          fetch,
        });
        await store.initialize();
        await store.toggleStudied('F02');
        holdCheck = true;
        const loading = store.acceptRemote('F02');
        await checking;
        const saving = store.toggleStudied('F01');
        await acknowledging;
        await send(owner, { ...mutation(owner, 'F01', 1), value: false });
        let unsubscribe = () => {};
        const newerRead = new Promise<void>((resolve) => {
          unsubscribe = store.subscribe(() => {
            const account = store.getAccountSnapshot();
            if (
              account.kind === 'account' &&
              account.records.some(
                (row) => row.lessonId === 'F01' && row.revision === 2,
              )
            )
              resolve();
          });
        });
        releaseCheck();
        await newerRead;
        unsubscribe();
        releaseAck();
        await Promise.all([saving, loading]);
        const account = store.getAccountSnapshot();
        assert.equal(account.kind, 'account');
        assert.equal(
          account.kind === 'account' &&
            account.records.find((row) => row.lessonId === 'F01')?.revision,
          2,
        );
        assert.equal(store.getSnapshot().studied.includes('F01'), false);
        assert.equal(store.getLessonSaveState('F01'), 'saved');
        const persisted = (await readJson(await read(owner))).records;
        assert.equal(persisted[0].revision, 2);
        assert.equal(persisted[0].studied, false);
      },
    );
  } finally {
    await mf.dispose();
  }
});
