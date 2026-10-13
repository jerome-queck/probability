import type { Lesson } from './types';

export function lessonMatches(query: string, lesson: Lesson): boolean {
  if (!query) return true;
  const haystack = [
    lesson.id,
    lesson.title,
    lesson.cluster,
    lesson.question,
    lesson.summary,
    lesson.theorem,
  ]
    .join(' ')
    .toLocaleLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
