import assert from 'node:assert/strict';
import test from 'node:test';
import { orphanProblems } from './orphans.mjs';

// Widths measured at 390px from real pages (evidence: probability-evidence/qg3).
test('E03 at daf7a37: σY = −bσX split in half at 390px fails', () => {
  const real = [{ text: 'σY​=−bσX​', widths: [44, 43] }];
  // The scrap rule alone (last piece under 40px) let this through.
  assert.ok(real.every((f) => f.widths.at(-1) >= 40));
  assert.match(orphanProblems(real).join('\n'), /short formula split/);
});

test('E03 at 23f740f: a scrap alone on the next line fails', () => {
  assert.match(
    orphanProblems([{ text: '22≤E[X2]E[Y2]=2⋅2,', widths: [154, 35] }]).join(
      '\n',
    ),
    /orphaned formula fragment/,
  );
});

test('long formulas may still wrap after a relation', () => {
  assert.deepEqual(
    orphanProblems([
      { text: '(E[XY])2≤E[X2]E[Y2].', widths: [98, 97] },
      { text: 'ρ(X,Y)=bσX2​/(σX​⋅bσX​)=1.', widths: [84, 154] },
      { text: 'x', widths: [12] },
    ]),
    [],
  );
});
