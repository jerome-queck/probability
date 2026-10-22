import type { Lesson } from './content/types';
import type { Progress } from './progress';

export type StudyIntent =
  | { kind: 'topic'; targetId: string }
  | { kind: 'review'; chapter: string | null };

type PathRow = {
  lesson: Lesson;
  reason:
    | { kind: 'target' }
    | { kind: 'prerequisite'; requiredBy: readonly Lesson[] }
    | { kind: 'review' };
};

export type StudyPlan = {
  intent: StudyIntent;
  path: readonly PathRow[];
  recall: readonly Lesson[];
  size: 3 | 5;
};

export type StudyVisit =
  | { kind: 'choose' }
  | { kind: 'invalid-goal'; requested: string }
  | { kind: 'empty-review'; chapter: string | null }
  | { kind: 'path'; plan: StudyPlan }
  | {
      kind: 'recall';
      plan: StudyPlan;
      cursor: {
        before: readonly Lesson[];
        current: Lesson;
        after: readonly Lesson[];
      };
      remaining: readonly (readonly Lesson[])[];
    }
  | {
      kind: 'summary';
      plan: StudyPlan;
      closed: readonly Lesson[];
      remaining: readonly (readonly Lesson[])[];
    };

export type StudyEvent =
  | {
      kind: 'build';
      intent: StudyIntent;
      progress: Progress;
      size?: 3 | 5;
    }
  | { kind: 'start' }
  | { kind: 'next' | 'previous' | 'finish'; expectedId: string }
  | { kind: 'choose-another' };

export function createStudyPlanReducer(catalogue: readonly Lesson[]) {
  const lessons = [...catalogue];
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const chapters = new Set(lessons.map((lesson) => lesson.cluster));

  return function studyPlanReducer(
    state: StudyVisit,
    event: StudyEvent,
  ): StudyVisit {
    switch (event.kind) {
      case 'build': {
        if (state.kind === 'recall') return state;
        const { progress } = event;
        const size = event.size ?? 3;
        if (event.intent.kind === 'review') {
          const { chapter } = event.intent;
          if (chapter !== null && !chapters.has(chapter))
            return { kind: 'invalid-goal', requested: chapter };
          const recall = lessons.filter(
            (lesson) =>
              progress.practice[lesson.id] === 'review' &&
              (chapter === null || lesson.cluster === chapter),
          );
          if (recall.length === 0) return { kind: 'empty-review', chapter };
          return {
            kind: 'path',
            plan: {
              intent: { kind: 'review', chapter },
              path: recall.map((lesson) => ({
                lesson,
                reason: { kind: 'review' },
              })),
              recall,
              size,
            },
          };
        }

        const { targetId } = event.intent;
        if (!byId.has(targetId))
          return { kind: 'invalid-goal', requested: targetId };
        const included = new Set<string>();
        function include(id: string) {
          const lesson = byId.get(id);
          if (!lesson || included.has(id)) return;
          included.add(id);
          for (const prerequisite of lesson.prerequisites)
            include(prerequisite);
        }
        include(targetId);
        const pathLessons = lessons.filter((lesson) => included.has(lesson.id));
        const studied = new Set(progress.studied);
        return {
          kind: 'path',
          plan: {
            intent: { kind: 'topic', targetId },
            path: pathLessons.map((lesson) => ({
              lesson,
              reason:
                lesson.id === targetId
                  ? { kind: 'target' }
                  : {
                      kind: 'prerequisite',
                      requiredBy: pathLessons.filter((dependent) =>
                        dependent.prerequisites.includes(lesson.id),
                      ),
                    },
            })),
            recall: pathLessons.filter(
              (lesson) =>
                lesson.id === targetId ||
                !studied.has(lesson.id) ||
                progress.practice[lesson.id] === 'review',
            ),
            size,
          },
        };
      }
      case 'start': {
        if (state.kind !== 'path' && state.kind !== 'summary') return state;
        const sets: (readonly Lesson[])[] = [];
        if (state.kind === 'path') {
          for (
            let index = 0;
            index < state.plan.recall.length;
            index += state.plan.size
          )
            sets.push(state.plan.recall.slice(index, index + state.plan.size));
        } else {
          sets.push(...state.remaining);
        }
        const [first, ...remaining] = sets;
        const [current, ...after] = first ?? [];
        if (!current) return state;
        return {
          kind: 'recall',
          plan: state.plan,
          cursor: { before: [], current, after },
          remaining,
        };
      }
      case 'next': {
        if (
          state.kind !== 'recall' ||
          state.cursor.current.id !== event.expectedId
        )
          return state;
        const [current, ...after] = state.cursor.after;
        if (!current) return state;
        return {
          ...state,
          cursor: {
            before: [...state.cursor.before, state.cursor.current],
            current,
            after,
          },
        };
      }
      case 'previous': {
        if (
          state.kind !== 'recall' ||
          state.cursor.current.id !== event.expectedId
        )
          return state;
        const current = state.cursor.before.at(-1);
        if (!current) return state;
        return {
          ...state,
          cursor: {
            before: state.cursor.before.slice(0, -1),
            current,
            after: [state.cursor.current, ...state.cursor.after],
          },
        };
      }
      case 'finish': {
        if (
          state.kind !== 'recall' ||
          state.cursor.current.id !== event.expectedId
        )
          return state;
        return {
          kind: 'summary',
          plan: state.plan,
          closed: [
            ...state.cursor.before,
            state.cursor.current,
            ...state.cursor.after,
          ],
          remaining: state.remaining,
        };
      }
      case 'choose-another':
        return state.kind === 'choose' ? state : { kind: 'choose' };
      default: {
        const exhaustive: never = event;
        return exhaustive;
      }
    }
  };
}
