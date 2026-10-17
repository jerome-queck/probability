import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { lessonMatches } from './search.ts';
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
  assert.ok(lessonMatches('', first));
  assert.ok(lessonMatches(first.id.toLowerCase(), first));
  assert.ok(lessonMatches('events sample', first));
  assert.ok(!lessonMatches('zebra', first));
});

test('search finds lognormal and Wald where the lessons teach them', () => {
  assert.ok(lessonMatches('lognormal', readLesson('./part05.json', 'R08')));
  assert.ok(lessonMatches('Wald', readLesson('./part07.json', 'E05')));
  assert.ok(!lessonMatches('Wald lognormal', first));
});

test('search ignores query case and excess whitespace', () => {
  assert.ok(lessonMatches('  SAMPLE  EvEnTs \n', first));
  assert.ok(lessonMatches('', first));
  assert.ok(lessonMatches(' \t\n ', first));
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
    assert.ok(lessonMatches(query, withText), query);
  }
});
