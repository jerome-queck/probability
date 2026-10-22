import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { matchLesson } from './search.ts';
import type { Lesson } from './types.ts';

const first: Lesson = JSON.parse(
  readFileSync(new URL('./part01.json', import.meta.url), 'utf8'),
)[0];

function readLesson(file: string, id: string): Lesson {
  const lessons: Lesson[] = JSON.parse(
    readFileSync(new URL(file, import.meta.url), 'utf8'),
  );
  const lesson = lessons.find((item) => item.id === id);
  assert.ok(lesson, `missing test lesson ${id}`);
  return lesson;
}

test('search matches IDs, titles and words in any order', () => {
  assert.notEqual(matchLesson('', first), null);
  assert.notEqual(matchLesson(first.id.toLowerCase(), first), null);
  assert.notEqual(matchLesson('events sample', first), null);
  assert.equal(matchLesson('zebra', first), null);
});

test('search finds lognormal and Wald where the lessons teach them', () => {
  assert.notEqual(
    matchLesson('lognormal', readLesson('./part05.json', 'R08')),
    null,
  );
  assert.notEqual(
    matchLesson('Wald', readLesson('./part07.json', 'E05')),
    null,
  );
  assert.equal(matchLesson('Wald lognormal', first), null);
});

test('search ignores query case and excess whitespace', () => {
  assert.notEqual(matchLesson('  SAMPLE  EvEnTs \n', first), null);
  assert.deepEqual(matchLesson('', first), { sectionLabels: [] });
  assert.deepEqual(matchLesson(' \t\n ', first), { sectionLabels: [] });
});

test('search includes worked steps, practice hints, solutions, and cautions', () => {
  const lesson = readLesson('./part07.json', 'E05');
  const withText: Lesson = {
    ...lesson,
    example: { ...lesson.example, steps: ['orchardsteps'] },
    practice: {
      prompt: 'orchardprompt',
      hints: ['orchardhint'],
      answer: 'orchardanswer',
    },
    caution: 'orchardcaution',
  };
  for (const query of [
    'orchardsteps',
    'orchardprompt',
    'orchardhint',
    'orchardanswer',
    'orchardcaution',
  ]) {
    assert.notEqual(matchLesson(query, withText), null, query);
  }
});

const indexed: Lesson = {
  id: 'X01',
  title: 'Visible heading',
  cluster: 'Visible chapter',
  question: 'questionword repeatedword',
  prerequisites: ['hiddenprerequisite'],
  results: ['hiddenresult'],
  summary: 'summaryword repeatedword',
  intuition: 'intuitionword',
  definition: ['definitionword'],
  theorem: 'claimword',
  hypotheses: ['conditionword'],
  proof: ['proofword'],
  example: {
    prompt: 'examplepromptword',
    steps: ['examplestepword'],
    conclusion: 'exampleconclusionword',
  },
  practice: {
    prompt: 'practicepromptword',
    hints: ['practicehintword'],
    answer: 'practiceanswerword',
  },
  caution: 'cautionword',
  reference: 'referenceword',
  lab: 'bayes',
};

test('content-only Boole match explains where to find the words', () => {
  assert.deepEqual(matchLesson('Boole', readLesson('./part01.json', 'F02')), {
    sectionLabels: ['Practice'],
  });
});

test('ID, title and chapter words need no section caption', () => {
  assert.deepEqual(matchLesson('X01 heading chapter', indexed), {
    sectionLabels: [],
  });
  assert.deepEqual(matchLesson('visible practicehintword', indexed), {
    sectionLabels: ['Practice'],
  });
});

test('all words can match across sections and labels follow section order', () => {
  assert.deepEqual(matchLesson('practicehintword definitionword', indexed), {
    sectionLabels: ['Definition', 'Practice'],
  });
  assert.equal(matchLesson('definitionword absentword', indexed), null);
});

test('repeated words and occurrences use only the first section witness', () => {
  assert.deepEqual(matchLesson('repeatedword repeatedword', indexed), {
    sectionLabels: ['Question'],
  });
  assert.deepEqual(
    matchLesson(
      'practicepromptword practicehintword practiceanswerword',
      indexed,
    ),
    { sectionLabels: ['Practice'] },
  );
  assert.deepEqual(
    matchLesson('visible repeatedword', {
      ...indexed,
      summary: 'visible repeatedword summaryword',
    }),
    { sectionLabels: ['Question'] },
  );
});

test('every searchable section supplies its visible label', () => {
  const cases = [
    ['QUESTIONWORD', 'Question'],
    ['summaryword', 'Summary'],
    ['intuitionword', 'Intuition'],
    ['definitionword', 'Definition'],
    ['claimword', 'The claim'],
    ['conditionword', 'Conditions'],
    ['proofword', 'Proof'],
    ['examplepromptword', 'Worked example'],
    ['examplestepword', 'Worked example'],
    ['exampleconclusionword', 'Worked example'],
    ['practicepromptword', 'Practice'],
    ['practicehintword', 'Practice'],
    ['practiceanswerword', 'Practice'],
    ['cautionword', 'Watch the boundary'],
    ['referenceword', 'Reference'],
  ];
  for (const [query, label] of cases)
    assert.deepEqual(
      matchLesson(query, indexed),
      { sectionLabels: [label] },
      query,
    );
});

test('optional bridge is searchable only when present', () => {
  assert.notEqual(matchLesson('referenceword', indexed), null);
  assert.equal(matchLesson('bridgeword', indexed), null);
  assert.deepEqual(
    matchLesson('bridgeword', { ...indexed, bridge: 'bridgeword' }),
    {
      sectionLabels: ['Looking ahead'],
    },
  );
});

test('search uses case-insensitive substrings but excludes metadata and labels', () => {
  assert.deepEqual(matchLesson('  PRaCtiCEhiNT  \tdefinition \n', indexed), {
    sectionLabels: ['Definition', 'Practice'],
  });
  for (const query of [
    'hiddenprerequisite',
    'hiddenresult',
    'bayes',
    'The claim',
  ])
    assert.equal(matchLesson(query, indexed), null, query);
});
