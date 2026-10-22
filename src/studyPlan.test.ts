import assert from 'node:assert/strict';
import test from 'node:test';
import type { Lesson } from './content/types';
import type { Progress } from './progress';
import { createStudyPlanReducer, type StudyVisit } from './studyPlan.ts';

function lesson(
  id: string,
  prerequisites: string[],
  cluster = 'Foundations',
): Lesson {
  return {
    id,
    title: `Lesson ${id}`,
    cluster,
    prerequisites,
    question: '',
    results: [],
    summary: '',
    intuition: '',
    definition: [],
    theorem: '',
    hypotheses: [],
    proof: [],
    example: { prompt: '', steps: [], conclusion: '' },
    practice: { prompt: '', hints: [], answer: '' },
    caution: '',
    reference: '',
  };
}

const catalogue = [
  lesson('A', []),
  lesson('B', ['A']),
  lesson('unrelated', []),
  lesson('C', ['A']),
  lesson('D', ['C', 'B', 'A'], 'Later'),
  lesson('E', ['D'], 'Later'),
  lesson('F', ['E'], 'Later'),
  lesson('G', ['F'], 'Later'),
];
const reduce = createStudyPlanReducer(catalogue);
const empty: Progress = { studied: [], practice: {} };

function ids(lessons: readonly Lesson[]) {
  return lessons.map((item) => item.id);
}

function topic(targetId: string, progress = empty, size?: 3 | 5) {
  const visit = reduce(
    { kind: 'choose' },
    { kind: 'build', intent: { kind: 'topic', targetId }, progress, size },
  );
  assert.ok(visit.kind === 'path');
  return visit;
}

function start(visit: StudyVisit) {
  const active = reduce(visit, { kind: 'start' });
  assert.ok(active.kind === 'recall');
  return active;
}

function finish(visit: StudyVisit) {
  assert.ok(visit.kind === 'recall');
  const summary = reduce(visit, {
    kind: 'finish',
    expectedId: visit.cursor.current.id,
  });
  assert.ok(summary.kind === 'summary');
  return summary;
}

test('a diamond path deduplicates shared ancestors in catalogue order', () => {
  const { plan } = topic('D');
  assert.deepEqual(ids(plan.path.map((row) => row.lesson)), [
    'A',
    'B',
    'C',
    'D',
  ]);
  assert.deepEqual(ids(plan.recall), ['A', 'B', 'C', 'D']);
  assert.deepEqual(
    plan.path.map((row) => ({
      id: row.lesson.id,
      reason: row.reason.kind,
      requiredBy:
        row.reason.kind === 'prerequisite' ? ids(row.reason.requiredBy) : [],
    })),
    [
      { id: 'A', reason: 'prerequisite', requiredBy: ['B', 'C', 'D'] },
      { id: 'B', reason: 'prerequisite', requiredBy: ['D'] },
      { id: 'C', reason: 'prerequisite', requiredBy: ['D'] },
      { id: 'D', reason: 'target', requiredBy: [] },
    ],
  );
});

test('unknown targets and chapters never substitute another goal', () => {
  assert.deepEqual(
    reduce(
      { kind: 'choose' },
      {
        kind: 'build',
        intent: { kind: 'topic', targetId: 'missing' },
        progress: empty,
      },
    ),
    { kind: 'invalid-goal', requested: 'missing' },
  );
  assert.deepEqual(
    reduce(
      { kind: 'choose' },
      {
        kind: 'build',
        intent: { kind: 'review', chapter: 'missing' },
        progress: empty,
      },
    ),
    { kind: 'invalid-goal', requested: 'missing' },
  );
});

test('known chapters and all-chapter review have explicit empty outcomes', () => {
  for (const chapter of ['Foundations', null]) {
    assert.deepEqual(
      reduce(
        { kind: 'choose' },
        {
          kind: 'build',
          intent: { kind: 'review', chapter },
          progress: {
            studied: [],
            practice: { A: 'got-it', foreign: 'review' },
          },
        },
      ),
      { kind: 'empty-review', chapter },
    );
  }
  const noLessons = createStudyPlanReducer([]);
  assert.deepEqual(
    noLessons(
      { kind: 'choose' },
      {
        kind: 'build',
        intent: { kind: 'review', chapter: null },
        progress: empty,
      },
    ),
    { kind: 'empty-review', chapter: null },
  );
});

test('got-it does not imply studied, and studied review prerequisites remain', () => {
  assert.deepEqual(
    ids(
      topic('D', { studied: [], practice: { A: 'got-it', B: 'got-it' } }).plan
        .recall,
    ),
    ['A', 'B', 'C', 'D'],
  );
  const { plan } = topic('D', {
    studied: ['A', 'B', 'C'],
    practice: { A: 'review', B: 'got-it' },
  });
  assert.deepEqual(ids(plan.recall), ['A', 'D']);
  assert.deepEqual(ids(plan.path.map((row) => row.lesson)), [
    'A',
    'B',
    'C',
    'D',
  ]);
});

test('a fully studied path still offers its target without altering records', () => {
  const progress: Progress = {
    studied: ['A', 'B', 'C', 'D'],
    practice: { D: 'got-it' },
  };
  const before = structuredClone(progress);
  const preview = topic('D', progress);
  assert.deepEqual(ids(preview.plan.recall), ['D']);
  const active = start(preview);
  assert.equal(active.cursor.current.id, 'D');
  assert.deepEqual(active.cursor.before, []);
  assert.deepEqual(active.cursor.after, []);
  assert.deepEqual(active.remaining, []);
  assert.deepEqual(ids(finish(active).closed), ['D']);
  assert.deepEqual(progress, before);
});

test('review captures only recorded problems in the requested chapter', () => {
  const progress: Progress = {
    studied: [],
    practice: {
      A: 'review',
      B: 'got-it',
      C: 'review',
      D: 'review',
      G: 'got-it',
    },
  };
  for (const [chapter, expected] of [
    [null, ['A', 'C', 'D']],
    ['Later', ['D']],
  ] satisfies [string | null, string[]][]) {
    const preview = reduce(
      { kind: 'choose' },
      { kind: 'build', intent: { kind: 'review', chapter }, progress },
    );
    assert.ok(preview.kind === 'path');
    assert.deepEqual(ids(preview.plan.recall), expected);
    assert.deepEqual(ids(preview.plan.path.map((row) => row.lesson)), expected);
    assert.ok(preview.plan.path.every((row) => row.reason.kind === 'review'));
  }
});

test('captured review membership survives changed records until explicit refresh', () => {
  const progress: Progress = {
    studied: [],
    practice: { A: 'review', D: 'review' },
  };
  const build = {
    kind: 'build',
    intent: { kind: 'review', chapter: null },
    progress,
  } satisfies Parameters<typeof reduce>[1];
  const preview = reduce({ kind: 'choose' }, build);
  assert.ok(preview.kind === 'path');
  progress.practice.A = 'got-it';
  delete progress.practice.D;
  progress.studied.push('A', 'D');
  const active = start(preview);
  assert.equal(active.cursor.current.id, 'A');
  assert.deepEqual(ids(active.cursor.after), ['D']);
  assert.deepEqual(ids(active.plan.recall), ['A', 'D']);
  assert.equal(reduce(active, build), active);
  const summary = finish(active);
  assert.deepEqual(ids(summary.closed), ['A', 'D']);
  assert.deepEqual(reduce(summary, build), {
    kind: 'empty-review',
    chapter: null,
  });
});

test('default three-problem sets continue to a distant target without study marks', () => {
  const progress: Progress = { studied: [], practice: {} };
  const preview = topic('G', progress);
  assert.equal(preview.plan.size, 3);
  const first = start(preview);
  assert.deepEqual(ids([first.cursor.current, ...first.cursor.after]), [
    'A',
    'B',
    'C',
  ]);
  assert.deepEqual(first.remaining.map(ids), [['D', 'E', 'F'], ['G']]);
  const firstSummary = finish(first);
  assert.deepEqual(ids(firstSummary.closed), ['A', 'B', 'C']);
  const second = start(firstSummary);
  assert.deepEqual(ids([second.cursor.current, ...second.cursor.after]), [
    'D',
    'E',
    'F',
  ]);
  assert.deepEqual(second.remaining.map(ids), [['G']]);
  const last = start(finish(second));
  assert.equal(last.cursor.current.id, 'G');
  assert.deepEqual(last.cursor.after, []);
  assert.deepEqual(last.remaining, []);
  const final = finish(last);
  assert.deepEqual(ids(final.closed), ['G']);
  assert.equal(reduce(final, { kind: 'start' }), final);
  assert.deepEqual(progress, { studied: [], practice: {} });
});

test('five-problem sets preserve canonical order and the shorter final set', () => {
  const first = start(topic('G', empty, 5));
  assert.deepEqual(ids([first.cursor.current, ...first.cursor.after]), [
    'A',
    'B',
    'C',
    'D',
    'E',
  ]);
  assert.deepEqual(first.remaining.map(ids), [['F', 'G']]);
  const last = start(finish(first));
  assert.deepEqual(ids([last.cursor.current, ...last.cursor.after]), [
    'F',
    'G',
  ]);
  assert.deepEqual(last.remaining, []);
});

test('captured later sets stay fixed when study marks change before continuation', () => {
  const progress: Progress = { studied: [], practice: {} };
  const preview = topic('G', progress);
  progress.studied.push('A', 'B', 'C', 'D', 'E', 'F', 'G');
  const first = start(preview);
  assert.deepEqual(first.remaining.map(ids), [['D', 'E', 'F'], ['G']]);
  const second = start(finish(first));
  assert.equal(second.cursor.current.id, 'D');
  const last = start(finish(second));
  assert.equal(last.cursor.current.id, 'G');
  const refreshed = reduce(finish(last), {
    kind: 'build',
    intent: { kind: 'topic', targetId: 'G' },
    progress,
  });
  assert.ok(refreshed.kind === 'path');
  assert.deepEqual(ids(refreshed.plan.recall), ['G']);
});

test('movement ignores stale expected IDs and both set boundaries', () => {
  const first = start(topic('D'));
  const snapshot = structuredClone(first);
  assert.equal(reduce(first, { kind: 'previous', expectedId: 'A' }), first);
  const second = reduce(first, { kind: 'next', expectedId: 'A' });
  assert.ok(second.kind === 'recall');
  assert.equal(second.cursor.current.id, 'B');
  assert.deepEqual(ids(second.cursor.before), ['A']);
  assert.deepEqual(ids(second.cursor.after), ['C']);
  assert.equal(reduce(second, { kind: 'next', expectedId: 'A' }), second);
  assert.equal(reduce(second, { kind: 'previous', expectedId: 'A' }), second);
  assert.equal(reduce(second, { kind: 'finish', expectedId: 'A' }), second);
  const back = reduce(second, { kind: 'previous', expectedId: 'B' });
  assert.deepEqual(back, first);
  assert.equal(reduce(back, { kind: 'previous', expectedId: 'B' }), back);
  const third = reduce(second, { kind: 'next', expectedId: 'B' });
  assert.ok(third.kind === 'recall');
  assert.equal(third.cursor.current.id, 'C');
  assert.equal(reduce(third, { kind: 'next', expectedId: 'C' }), third);
  const summary = finish(third);
  assert.deepEqual(ids(summary.closed), ['A', 'B', 'C']);
  assert.equal(reduce(summary, { kind: 'finish', expectedId: 'C' }), summary);
  assert.deepEqual(first, snapshot);
});

test('invalid lifecycle events are inert and choosing another plan discards recall', () => {
  const choose: StudyVisit = { kind: 'choose' };
  const preview = topic('A');
  const active = start(preview);
  for (const state of [choose, preview, finish(active)]) {
    for (const kind of ['next', 'previous', 'finish'] satisfies (
      | 'next'
      | 'previous'
      | 'finish'
    )[]) {
      assert.equal(reduce(state, { kind, expectedId: 'A' }), state);
    }
  }
  assert.equal(reduce(choose, { kind: 'start' }), choose);
  assert.equal(reduce(active, { kind: 'start' }), active);
  assert.equal(reduce(choose, { kind: 'choose-another' }), choose);
  assert.deepEqual(reduce(active, { kind: 'choose-another' }), choose);
});
