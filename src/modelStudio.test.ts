import assert from 'node:assert/strict';
import test from 'node:test';
import {
  newStudioVisit,
  readStudio,
  type StudioCommand,
  type StudioVisit,
  updateStudio,
} from './modelStudio.ts';

function edit(visit: StudioVisit, ...commands: StudioCommand[]) {
  return commands.reduce(updateStudio, visit);
}

function weights(values: readonly string[], visit = newStudioVisit()) {
  return edit(
    visit,
    ...values.map(
      (raw, index): StudioCommand => ({
        type: 'set-weight',
        id: index + 1,
        raw,
      }),
    ),
  );
}

test('balanced and uneven models give reduced exact probabilities and product checks', () => {
  const initial = readStudio(newStudioVisit());
  assert.equal(initial.current.kind, 'valid');
  if (initial.current.kind !== 'valid') return;
  assert.equal(initial.current.pA.text, '1/2');
  assert.equal(initial.current.pB.text, '1/2');
  assert.equal(initial.current.pAB.text, '1/4');
  assert.equal(initial.current.product.text, '1/4');
  assert.deepEqual(initial.current.conditional, {
    kind: 'defined',
    value: { numerator: 1, denominator: 2, text: '1/2' },
  });
  assert.equal(initial.current.relationship, 'independent');
  const uneven = readStudio(weights(['3', '1', '1', '1'])).current;
  assert.equal(uneven.kind, 'valid');
  if (uneven.kind !== 'valid') return;
  assert.equal(uneven.pA.text, '2/3');
  assert.equal(uneven.pB.text, '2/3');
  assert.equal(uneven.pAB.text, '1/2');
  assert.equal(uneven.product.text, '4/9');
  assert.equal(
    uneven.conditional.kind === 'defined' && uneven.conditional.value.text,
    '3/4',
  );
  assert.equal(uneven.relationship, 'dependent');
});

test('product criterion agrees with the four-region determinant for every small weighted model', () => {
  for (let hh = 0; hh < 4; hh++)
    for (let ht = 0; ht < 4; ht++)
      for (let th = 0; th < 4; th++)
        for (let tt = 0; tt < 4; tt++) {
          const reading = readStudio(
            weights([hh, ht, th, tt].map(String)),
          ).current;
          if (hh + ht + th + tt === 0) {
            assert.equal(reading.kind, 'invalid');
            continue;
          }
          assert.equal(reading.kind, 'valid');
          if (reading.kind !== 'valid') continue;
          assert.equal(
            reading.relationship === 'independent',
            hh * tt === ht * th,
            `${hh},${ht},${th},${tt}`,
          );
          assert.equal(
            reading.conditional.kind,
            hh + th === 0 ? 'undefined' : 'defined',
          );
        }
});

test('zero evidence preserves event membership and independence but never defines 0/0', () => {
  const view = readStudio(
    edit(
      newStudioVisit(),
      { type: 'load-example', id: 'zero-evidence' },
      { type: 'set-condition', value: 'B' },
    ),
  );
  assert.equal(view.current.kind, 'valid');
  if (view.current.kind !== 'valid') return;
  assert.equal(view.current.pB.text, '0');
  assert.equal(view.current.pA.text, '1/4');
  assert.equal(view.current.relationship, 'independent');
  assert.deepEqual(view.current.conditional, { kind: 'undefined' });
  assert.deepEqual(
    view.rows.map((row) => row.contribution),
    ['Excluded', 'Numerator and denominator', 'Excluded', 'Denominator only'],
  );
  assert.equal(view.rows[1].inB, true);
  assert.match(view.note, /undefined because B has total weight 0/);
});

test('raw invalid weights pause all current results and export the unfinished attempt', () => {
  for (const raw of ['', ' ', '-1', '1.5', '1e2', '1000', 'Infinity', 'NaN']) {
    const visit = edit(
      newStudioVisit(),
      { type: 'pin-current' },
      { type: 'set-weight', id: 1, raw },
      { type: 'set-reflection', raw: 'I am revising the weight.' },
    );
    const view = readStudio(visit);
    assert.equal(view.current.kind, 'invalid', raw);
    assert.equal('pA' in view.current, false);
    assert.equal(view.rows[0].weight, raw);
    assert.match(
      view.note,
      new RegExp(
        `raw weight ${JSON.stringify(raw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      ),
    );
    assert.match(view.note, /Results unavailable/);
    assert.match(view.note, /I am revising the weight/);
    assert.ok(view.pinned);
    assert.equal(updateStudio(visit, { type: 'pin-current' }), visit);
  }
  const zero = readStudio(weights(['0', '0', '0', '0']));
  assert.equal(zero.current.kind, 'invalid');
  assert.match(zero.note, /Total weight is 0/);
});

test('empty, overlong and duplicate labels block the model without losing raw text', () => {
  for (const raw of ['', ' ', 'x'.repeat(25), ' HT ']) {
    const view = readStudio(
      edit(newStudioVisit(), { type: 'set-label', id: 1, raw }),
    );
    assert.equal(view.current.kind, 'invalid');
    assert.equal(view.rows[0].label, raw);
    assert.ok(view.rows[0].issues.some((issue) => issue.field === 'label'));
  }
});

test('pin copies validated atoms and descriptions; preset and clear preserve the reflection', () => {
  const pinned = edit(
    newStudioVisit(),
    { type: 'set-description', field: 'A', raw: 'Original event' },
    { type: 'pin-current' },
    { type: 'set-reflection', raw: 'My explanation' },
  );
  const changed = edit(
    pinned,
    { type: 'set-description', field: 'A', raw: 'Changed event' },
    { type: 'set-weight', id: 1, raw: '3' },
  );
  const view = readStudio(changed);
  assert.equal(view.pinned?.description.A, 'Original event');
  assert.equal(view.pinned?.model.atoms[0].weight, 1);
  assert.equal(view.pinned?.model.reading.pA.text, '1/2');
  assert.match(view.note, /Changed event/);
  assert.match(view.note, /Original event/);
  const preset = readStudio(
    edit(changed, { type: 'load-example', id: 'zero-evidence' }),
  );
  assert.equal(preset.reflection, 'My explanation');
  assert.equal(preset.pinned?.description.A, 'Original event');
  const cleared = readStudio(edit(changed, { type: 'clear-comparison' }));
  assert.equal(cleared.pinned, null);
  assert.equal(cleared.rows[0].weight, '3');
  assert.equal(cleared.reflection, 'My explanation');
  assert.equal(
    readStudio(edit(changed, { type: 'start-over' })).note,
    readStudio(newStudioVisit()).note,
  );
});

test('desired membership edits are idempotent and condition changes the reading without changing atoms', () => {
  const command = {
    type: 'set-membership',
    id: 1,
    event: 'A',
    included: false,
  } satisfies StudioCommand;
  const once = edit(newStudioVisit(), command);
  assert.deepEqual(readStudio(edit(once, command)), readStudio(once));
  const conditional = readStudio(
    edit(once, { type: 'set-condition', value: 'B' }),
  );
  assert.deepEqual(conditional.current, readStudio(once).current);
  assert.deepEqual(
    conditional.rows.map((row) => row.contribution),
    ['Denominator only', 'Excluded', 'Denominator only', 'Excluded'],
  );
});

test('outcome bounds and identities stay usable after removal, addition and maximum weights', () => {
  let visit = newStudioVisit();
  for (let i = 0; i < 20; i++) visit = edit(visit, { type: 'add-outcome' });
  const full = readStudio(visit);
  assert.equal(full.rows.length, 12);
  assert.equal(full.canAdd, false);
  visit = edit(
    visit,
    ...full.rows.map(
      (row): StudioCommand => ({ type: 'set-weight', id: row.id, raw: '999' }),
    ),
  );
  const maximum = readStudio(visit).current;
  assert.equal(maximum.kind === 'valid' && maximum.total, 11988);
  assert.equal(maximum.kind === 'valid' && maximum.pA.text, '1/6');
  assert.equal(maximum.kind === 'valid' && maximum.product.text, '1/36');
  for (const row of readStudio(visit).rows)
    visit = edit(visit, { type: 'remove-outcome', id: row.id });
  const last = readStudio(visit);
  assert.equal(last.rows.length, 1);
  assert.equal(last.canRemove, false);
  const survivingId = last.rows[0].id;
  visit = edit(visit, { type: 'add-outcome' });
  assert.equal(readStudio(visit).rows[0].id, survivingId);
  assert.notEqual(readStudio(visit).rows[1].id, survivingId);
});

test('common weight scaling leaves every probability and relationship unchanged', () => {
  const base = readStudio(weights(['3', '2', '5', '7'])).current;
  const scaled = readStudio(weights(['297', '198', '495', '693'])).current;
  assert.equal(base.kind, 'valid');
  assert.equal(scaled.kind, 'valid');
  if (base.kind !== 'valid' || scaled.kind !== 'valid') return;
  for (const key of [
    'pA',
    'pB',
    'pAB',
    'conditional',
    'product',
    'relationship',
  ] as const)
    assert.deepEqual(base[key], scaled[key]);
});
