import order from './order.json';
import type { Lesson } from './types';

const parts = import.meta.glob<{ default: Lesson[] }>('./part*.json', {
  eager: true,
});
const all = Object.values(parts).flatMap((module) => module.default);
const byId = new Map(all.map((lesson) => [lesson.id, lesson]));

export const lessons: Lesson[] = order.map((id) => {
  const lesson = byId.get(id);
  if (!lesson) throw new Error(`order.json names a missing lesson ${id}`);
  return lesson;
});
