import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Miniflare } from 'miniflare';

const root = process.env.FORMAL_PROGRESS_ROOT ?? process.cwd();
const { createProgressStore } = await import(
  pathToFileURL(`${root}/src/progress.ts`)
);
const { handleAccount, handleProgress } = await import(
  pathToFileURL(`${root}/server/progress.ts`)
);
const origin = 'https://study.test';
const lessonId = 'F01';
const command = (owner, revision = 0, id = 'first', value = true) => ({
  expectedOwner: owner,
  expectedRevision: revision,
  lessonId,
  mutationId: id.padEnd(16, '_'),
  field: 'studied',
  value,
});
const patch = (body) =>
  new Request(`${origin}/api/progress`, {
    method: 'PATCH',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const mf = new Miniflare({
  telemetry: { enabled: false },
  workers: [
    {
      config: {
        name: 'formal-progress',
        compatibilityDate: '2026-10-01',
        manifest: {
          mainModule: 'index.js',
          modules: {
            'index.js': {
              type: 'esm',
              contents:
                'export default { fetch() { return new Response(); } };',
            },
          },
        },
        env: { DB: { type: 'd1', id: 'formal-progress' } },
      },
    },
  ],
});
const report = { serverSchedules: 0, clientSchedules: 0, assertions: [] };

try {
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('drizzle'))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    for (const sql of (await readFile(`drizzle/${file}`, 'utf8')).split(
      '--> statement-breakpoint',
    ))
      if (sql.trim()) await db.prepare(sql).run();
  }
  const context = (owner, database = db) => ({
    db: database,
    user: owner ? { userId: owner } : null,
  });
  const send = (owner, mutation, database = db) =>
    handleProgress(patch(mutation), context(owner, database));
  const rows = async () =>
    (
      await db
        .prepare('SELECT * FROM lesson_progress ORDER BY owner, lesson_id')
        .all()
    ).results;
  const read = async (owner) =>
    (
      await handleProgress(
        new Request(`${origin}/api/progress`),
        context(owner),
      )
    ).json();
  const reset = async (seed = []) => {
    await db.prepare('DELETE FROM lesson_progress').run();
    for (const owner of seed) {
      assert.equal((await send(owner, command(owner))).status, 200);
    }
  };

  const scenarios = [
    {
      name: 'insert-race',
      seed: [],
      owners: ['A', 'A'],
      commands: [command('A'), command('A', 0, 'second', false)],
    },
    {
      name: 'duplicate-insert',
      seed: [],
      owners: ['A', 'A'],
      commands: [command('A'), command('A')],
    },
    {
      name: 'unrelated-id',
      seed: [],
      owners: ['A', 'A'],
      commands: [command('A'), command('A', 0, 'second')],
    },
    {
      name: 'same-id-wrong-value',
      seed: [],
      owners: ['A', 'A'],
      commands: [command('A'), command('A', 0, 'first', false)],
    },
    {
      name: 'update-race',
      seed: ['A'],
      owners: ['A', 'A'],
      commands: [command('A', 1, 'second', false), command('A', 1, 'third')],
    },
    {
      name: 'duplicate-update',
      seed: ['A'],
      owners: ['A', 'A'],
      commands: [
        command('A', 1, 'second', false),
        command('A', 1, 'second', false),
      ],
    },
    {
      name: 'independent-owners',
      seed: [],
      owners: ['A', 'B'],
      commands: [command('A'), command('B')],
    },
    {
      name: 'isolated-updates',
      seed: ['A', 'B'],
      owners: ['A', 'B'],
      commands: [command('A', 1, 'second', false), command('B', 1, 'third')],
    },
    {
      name: 'wrong-owner',
      seed: [],
      owners: ['B', 'A'],
      commands: [command('A'), command('B')],
    },
    {
      name: 'stale-update',
      seed: ['A'],
      owners: ['A', 'A'],
      commands: [command('A', 0, 'second'), command('A', 1, 'third', false)],
    },
  ];

  for (const scenario of scenarios) {
    const prefixes = [[]];
    while (prefixes.length) {
      const prefix = prefixes.pop();
      await reset(scenario.seed);
      const trace = [];
      const states = scenario.commands.map(() => ({
        pending: null,
        done: false,
        changed: deferred(),
        wrote: false,
        fallback: null,
      }));
      const signal = (state) => {
        state.changed.resolve();
        state.changed = deferred();
      };
      const gated = (index) => ({
        prepare(sql) {
          let statement = db.prepare(sql);
          const wrapper = {
            bind(...args) {
              statement = statement.bind(...args);
              return wrapper;
            },
            first(...args) {
              const gate = deferred();
              states[index].pending = {
                sql,
                run: () => statement.first(...args),
                gate,
              };
              signal(states[index]);
              return gate.promise;
            },
          };
          return wrapper;
        },
      });
      const responses = scenario.commands.map(async (mutation, index) => {
        const response = await send(
          scenario.owners[index],
          mutation,
          gated(index),
        );
        const body = await response.json();
        const state = states[index];
        state.done = true;
        signal(state);
        if (mutation.expectedOwner !== scenario.owners[index]) {
          assert.equal(
            response.status,
            409,
            'OwnerAuthorized: reject an intent for another owner',
          );
          assert.equal(
            state.wrote,
            false,
            'OwnerAuthorized: mismatched owner must not write',
          );
        } else if (response.status === 200 && !state.wrote) {
          const row = state.fallback;
          assert.ok(row, 'ReplayHonest: acknowledgement requires a row');
          assert.equal(
            row.last_mutation_id,
            mutation.mutationId,
            'ReplayHonest: acknowledge the same mutation',
          );
          assert.equal(
            row.revision,
            mutation.expectedRevision + 1,
            'ReplayHonest: acknowledge exactly one revision',
          );
          assert.equal(
            row.studied === 1,
            mutation.value,
            'ReplayHonest: acknowledge the desired value',
          );
        }
        return { status: response.status, body };
      });
      let depth = 0;
      while (states.some((state) => !state.done)) {
        await Promise.all(
          states.map(async (state) => {
            while (!state.done && !state.pending) await state.changed.promise;
          }),
        );
        const choices = states.flatMap((state, index) =>
          state.pending ? [index] : [],
        );
        if (!choices.length) break;
        const choice = prefix[depth] ?? choices[0];
        assert.ok(
          choices.includes(choice),
          'SQL schedule prefix remains executable',
        );
        if (depth >= prefix.length)
          for (const alternate of choices.slice(1))
            prefixes.push([...trace, alternate]);
        trace.push(choice);
        depth++;
        const state = states[choice];
        const pending = state.pending;
        state.pending = null;
        const before = await rows();
        const result = await pending.run();
        const after = await rows();
        const mutation = scenario.commands[choice];
        const owner = scenario.owners[choice];
        if (/^(INSERT|UPDATE)/.test(pending.sql)) {
          if (result) {
            const previous = before.find((row) => row.owner === owner);
            assert.equal(
              previous?.revision ?? 0,
              mutation.expectedRevision,
              'RevisionChecked: SQL compares the current revision',
            );
            assert.equal(
              mutation.expectedOwner,
              owner,
              'OwnerAuthorized: SQL write matches the intended account',
            );
            assert.equal(
              result.revision,
              mutation.expectedRevision + 1,
              'RetryAtMostOnce: one write advances one revision',
            );
            assert.equal(
              state.wrote,
              false,
              'RetryAtMostOnce: a request writes once',
            );
            state.wrote = true;
          }
        } else state.fallback = result;
        assert.deepEqual(
          after.filter((row) => row.owner !== owner),
          before.filter((row) => row.owner !== owner),
          'OwnerAuthorized: a statement cannot alter another owner',
        );
        pending.gate.resolve(result);
      }
      await Promise.all(responses);
      report.serverSchedules++;
    }
  }
  report.assertions.push(
    'OwnerAuthorized',
    'RevisionChecked',
    'RetryAtMostOnce',
    'ReplayHonest',
  );

  const storage = () => {
    const value = JSON.stringify({ studied: ['F02'], practice: {} });
    return {
      getItem: () => value,
      setItem: () =>
        assert.fail('Account actions must not write guest storage'),
    };
  };
  const transport = (owner) => async (input, init) => {
    const url = new URL(String(input), origin);
    const headers = new Headers(init?.headers);
    if (init?.method === 'PATCH') headers.set('Origin', origin);
    return url.pathname === '/api/account'
      ? handleAccount(context(owner()))
      : handleProgress(
          new Request(url, { ...init, headers }),
          context(owner()),
        );
  };
  const hold = (base, matches, boundary) => {
    const entered = deferred();
    const release = deferred();
    let used = false;
    return {
      entered: entered.promise,
      release: release.resolve,
      fetch: async (input, init) => {
        const response = await base(input, init);
        if (used || !matches(input, init)) return response;
        used = true;
        if (boundary === 'http') {
          entered.resolve();
          await release.promise;
          return response;
        }
        return new Proxy(response, {
          get(target, property) {
            if (property === 'json')
              return async () => {
                const value = await target.json();
                entered.resolve();
                await release.promise;
                return value;
              };
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    };
  };
  const rowOf = (store) => {
    const account = store.getAccountSnapshot();
    assert.equal(account.kind, 'account');
    return account.records.find((row) => row.lessonId === lessonId);
  };
  const observe = (store, predicate) => {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve) => {
      const unsubscribe = store.subscribe(() => {
        if (predicate()) {
          unsubscribe();
          resolve();
        }
      });
    });
  };

  for (const boundary of ['http', 'json']) {
    for (const nextOwner of ['A', 'B']) {
      await reset();
      let owner = 'A';
      const delayed = hold(
        transport(() => owner),
        (_input, init) => init?.method === 'PATCH',
        boundary,
      );
      const store = createProgressStore({
        storage: storage(),
        fetch: delayed.fetch,
      });
      await store.initialize();
      const saving = store.toggleStudied(lessonId);
      await delayed.entered;
      owner = nextOwner;
      await store.refreshAccount();
      delayed.release();
      await saving;
      const account = store.getAccountSnapshot();
      assert.equal(
        account.owner,
        nextOwner,
        'GenerationIsolated: late write cannot replace the active owner',
      );
      if (nextOwner === 'A') {
        assert.equal(
          store.getLessonSaveState(lessonId),
          'error',
          'GenerationIsolated: an old write cannot settle a retained intent',
        );
        assert.equal(
          store.hasPendingAccountChanges(),
          true,
          'GenerationIsolated: stale completion keeps the refreshed queue intact',
        );
      } else {
        assert.deepEqual(
          store.getSnapshot().studied,
          [],
          'GenerationIsolated: another owner never sees the old mark',
        );
      }
      report.clientSchedules++;
    }

    await reset();
    const baseCurrent = transport(() => 'A');
    const oldRead = hold(
      baseCurrent,
      (input, init) => String(input) === '/api/progress' && !init?.method,
      boundary,
    );
    let holdRead = false;
    const retained = createProgressStore({
      storage: storage(),
      fetch: (input, init) => {
        if (init?.method === 'PATCH')
          return Promise.reject(new Error('offline'));
        return holdRead ? oldRead.fetch(input, init) : baseCurrent(input, init);
      },
    });
    await retained.initialize();
    await retained.toggleStudied(lessonId);
    holdRead = true;
    const accepting = retained.acceptRemote(lessonId);
    await oldRead.entered;
    await retained.refreshAccount();
    oldRead.release();
    await accepting;
    assert.equal(
      retained.getLessonSaveState(lessonId),
      'error',
      'GenerationIsolated: an old GET cannot discard a retained intent',
    );
    assert.equal(
      retained.hasPendingAccountChanges(),
      true,
      'GenerationIsolated: refreshed intents need a current explicit choice',
    );
    report.clientSchedules++;

    await reset(['A']);
    const delayedRead = hold(
      transport(() => 'A'),
      (input, init) => String(input) === '/api/progress' && !init?.method,
      boundary,
    );
    let armed = false;
    const base = transport(() => 'A');
    const store = createProgressStore({
      storage: storage(),
      fetch: (...args) => (armed ? delayedRead.fetch(...args) : base(...args)),
    });
    await store.initialize();
    armed = true;
    const reading = store.acceptRemote();
    await delayedRead.entered;
    await store.toggleStudied(lessonId);
    delayedRead.release();
    await reading;
    assert.equal(
      rowOf(store).revision,
      2,
      'ConfirmedRevisionMonotone: an old GET cannot replace a newer write',
    );
    assert.equal(
      store.getSnapshot().studied.includes(lessonId),
      false,
      'ConfirmedRevisionMonotone: the newer value stays visible',
    );
    report.clientSchedules++;

    await reset();
    const delayedWrite = hold(
      base,
      (_input, init) => init?.method === 'PATCH',
      boundary,
    );
    const other = createProgressStore({
      storage: storage(),
      fetch: delayedWrite.fetch,
    });
    await other.initialize();
    const saving = other.toggleStudied(lessonId);
    await delayedWrite.entered;
    assert.equal(
      (await send('A', command('A', 1, 'external', false))).status,
      200,
    );
    const observed = observe(other, () => rowOf(other)?.revision === 2);
    const readingNew = other.acceptRemote('F02');
    await observed;
    delayedWrite.release();
    await Promise.all([saving, readingNew]);
    assert.equal(
      rowOf(other).revision,
      2,
      'ConfirmedRevisionMonotone: an old PATCH cannot replace a newer GET',
    );
    assert.equal(
      other.getSnapshot().studied.includes(lessonId),
      false,
      'ConfirmedRevisionMonotone: the later confirmed value survives',
    );
    report.clientSchedules++;
  }
  report.assertions.push('GenerationIsolated', 'ConfirmedRevisionMonotone');

  await reset(['A', 'B']);
  const baseA = transport(() => 'A');
  const baseB = transport(() => 'B');
  let foreign = false;
  const foreignStore = createProgressStore({
    storage: storage(),
    fetch: (input, init) =>
      foreign && String(input) === '/api/progress' && !init?.method
        ? baseB(input, init)
        : baseA(input, init),
  });
  await foreignStore.initialize();
  foreign = true;
  await foreignStore.acceptRemote();
  assert.match(
    foreignStore.getAccountSnapshot().message,
    /Could not load the account version/,
    'ResponseOwnerChecked: reject a GET for another account',
  );
  assert.equal(
    foreignStore.getAccountSnapshot().owner,
    'A',
    'ResponseOwnerChecked: preserve the known owner',
  );
  report.clientSchedules++;
  report.assertions.push('ResponseOwnerChecked');

  for (const field of ['studied', 'verdict']) {
    for (const seeded of [false, true]) {
      await reset(seeded ? ['A'] : []);
      let lose = true;
      const store = createProgressStore({
        storage: storage(),
        fetch: async (input, init) => {
          const response = await baseA(input, init);
          if (lose && init?.method === 'PATCH') {
            lose = false;
            throw new Error('Committed response lost');
          }
          return response;
        },
      });
      await store.initialize();
      if (field === 'studied') await store.toggleStudied(lessonId);
      else await store.setVerdict(lessonId, 'review');
      assert.equal(store.getLessonSaveState(lessonId), 'error');
      const committed = await read('A');
      await store.retry();
      assert.equal(
        store.getLessonSaveState(lessonId),
        'saved',
        'RetryAtMostOnce: a lost response retries the original command',
      );
      assert.deepEqual(
        await read('A'),
        committed,
        'RetryAtMostOnce: a retry cannot apply a second write',
      );
      report.clientSchedules++;
    }
  }
  console.log(JSON.stringify(report));
} finally {
  await mf.dispose();
}
