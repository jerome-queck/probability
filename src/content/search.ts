import type { Lesson } from './types';

export type LessonMatch = {
  readonly sectionLabels: readonly string[];
};

type SearchSection = {
  readonly label: string | null;
  readonly text: string;
};

export function matchLesson(query: string, lesson: Lesson): LessonMatch | null {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { sectionLabels: [] };
  const sections = searchableSections(lesson);
  const haystack = sections
    .map(({ text }) => text)
    .join(' ')
    .toLocaleLowerCase();
  if (!words.every((word) => haystack.includes(word))) return null;

  const uncovered = new Set(words);
  const sectionLabels: string[] = [];
  for (const { label, text } of sections) {
    const normalized = text.toLocaleLowerCase();
    let suppliesWord = false;
    for (const word of uncovered) {
      if (normalized.includes(word)) {
        uncovered.delete(word);
        suppliesWord = true;
      }
    }
    if (label !== null && suppliesWord) sectionLabels.push(label);
  }
  return { sectionLabels };
}

function searchableSections(lesson: Lesson): readonly SearchSection[] {
  return [
    { label: null, text: [lesson.id, lesson.title, lesson.cluster].join(' ') },
    { label: 'Question', text: lesson.question },
    { label: 'Summary', text: lesson.summary },
    { label: 'Intuition', text: lesson.intuition },
    { label: 'Definition', text: lesson.definition.join(' ') },
    { label: 'The claim', text: lesson.theorem },
    { label: 'Conditions', text: lesson.hypotheses.join(' ') },
    { label: 'Proof', text: lesson.proof.join(' ') },
    {
      label: 'Worked example',
      text: [
        lesson.example.prompt,
        ...lesson.example.steps,
        lesson.example.conclusion,
      ].join(' '),
    },
    {
      label: 'Practice',
      text: [
        lesson.practice.prompt,
        ...lesson.practice.hints,
        lesson.practice.answer,
      ].join(' '),
    },
    { label: 'Watch the boundary', text: lesson.caution },
    { label: 'Looking ahead', text: lesson.bridge ?? '' },
    { label: 'Reference', text: lesson.reference },
  ];
}
