import type { Lesson } from './types';

export function lessonMatches(query: string, lesson: Lesson): boolean {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [
    lesson.id,
    lesson.title,
    lesson.cluster,
    lesson.question,
    lesson.summary,
    lesson.intuition,
    ...lesson.definition,
    lesson.theorem,
    ...lesson.hypotheses,
    ...lesson.proof,
    lesson.example.prompt,
    ...lesson.example.steps,
    lesson.example.conclusion,
    lesson.practice.prompt,
    ...lesson.practice.hints,
    lesson.practice.answer,
    lesson.caution,
    lesson.bridge,
    lesson.reference,
  ]
    .join(' ')
    .toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}
