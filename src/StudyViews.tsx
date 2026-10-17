import { useState, useSyncExternalStore } from 'react';
import checkpoints from './content/checkpoints.json';
import distributions from './content/distributions.json';
import { lessons } from './content/lessons';
import { lessonMatches } from './content/search';
import type { ChapterCheckpoint, DistributionReference } from './content/types';
import { Practice } from './LessonPage';
import { MathText } from './MathText';
import { progressStore } from './progress';

const chapters = [...new Set(lessons.map((lesson) => lesson.cluster))];

export function PracticeSession() {
  const progress = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
  );
  const [chapter, setChapter] = useState('all');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rank = (id: string) =>
    progress.practice[id] === 'review'
      ? 0
      : progress.practice[id] === 'got-it'
        ? 2
        : 1;
  const selected = lessons
    .filter((lesson) => chapter === 'all' || lesson.cluster === chapter)
    .filter(
      (lesson) => !reviewOnly || progress.practice[lesson.id] === 'review',
    )
    .sort((a, b) => rank(a.id) - rank(b.id));
  const visible = showAll ? selected : selected.slice(0, 5);
  return (
    <div className="overview-shell">
      <header className="overview-heading">
        <p className="eyebrow">RECALL, THEN CHECK</p>
        <h1 tabIndex={-1}>One problem per lesson</h1>
        <p>
          Attempt a small set before opening hints. Your self-ratings put
          problems to review first. They record your judgment, not a grade.
        </p>
      </header>
      <div className="study-controls">
        <label>
          Chapter
          <select
            value={chapter}
            onChange={(event) => {
              setChapter(event.target.value);
              setShowAll(false);
            }}
          >
            <option value="all">All chapters</option>
            {chapters.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={reviewOnly}
            onChange={(event) => setReviewOnly(event.target.checked)}
          />
          Only problems I marked for review
        </label>
        <p role="status">
          {visible.length} of {selected.length} problems shown
        </p>
      </div>
      {!selected.length && (
        <p className="study-empty">
          No problems match this selection. Choose another chapter or include
          all problems.
        </p>
      )}
      <div className="practice-list">
        {visible.map((lesson) => (
          <Practice key={lesson.id} lesson={lesson} embedded />
        ))}
      </div>
      {selected.length > 5 && (
        <button
          type="button"
          className="study-button"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Return to five problems' : 'Show all problems'}
        </button>
      )}
      <section
        className="overview-section"
        aria-labelledby="checkpoints-heading"
      >
        <p className="eyebrow">CONNECT THE IDEAS</p>
        <h2 id="checkpoints-heading">Chapter checkpoints</h2>
        <p>
          Choose the model, state its conditions, and explain your reasoning.
          These extra problems are for self-study. Their answers are not graded.
        </p>
        {(checkpoints satisfies ChapterCheckpoint[])
          .filter((set) => chapter === 'all' || set.cluster === chapter)
          .map((set) => (
            <details className="checkpoint-set" key={set.id}>
              <summary>{set.title}</summary>
              {set.problems.map((problem, index) => (
                <article className="checkpoint-problem" key={problem.id}>
                  <h3>Problem {index + 1}</h3>
                  <MathText text={problem.prompt} />
                  <details>
                    <summary>Hints</summary>
                    {problem.hints.map((hint) => (
                      <p key={hint}>
                        <MathText text={hint} />
                      </p>
                    ))}
                  </details>
                  <details>
                    <summary>Solution</summary>
                    <MathText text={problem.answer} />
                  </details>
                  <small>Revisit {problem.lessonIds.join(', ')}.</small>
                </article>
              ))}
            </details>
          ))}
      </section>
    </div>
  );
}

export function CourseReference({ open }: { open: (id: string) => void }) {
  const [tab, setTab] = useState<'results' | 'distributions'>('results');
  const [query, setQuery] = useState('');
  const resultLessons = lessons.filter((lesson) =>
    lessonMatches(query, lesson),
  );
  const families = (distributions satisfies DistributionReference[]).filter(
    (item) =>
      Object.values(item)
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="overview-shell">
      <header className="overview-heading">
        <p className="eyebrow">LOOK UP THE CONDITIONS</p>
        <h1 tabIndex={-1}>Results and distributions</h1>
        <p>
          Check the support and assumptions before using a formula. Open its
          lesson for the derivation and worked example.
        </p>
      </header>
      <div className="study-controls">
        <fieldset className="reference-switch">
          <legend>Reference collection</legend>
          {(['results', 'distributions'] as const).map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={tab === item}
              onClick={() => setTab(item)}
            >
              {item === 'results' ? 'Lesson results' : 'Distribution guide'}
            </button>
          ))}
        </fieldset>
        <label>
          Find in reference
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A name, condition, or lesson ID"
          />
        </label>
      </div>
      {tab === 'results' ? (
        <dl className="reference-list">
          {resultLessons.map((lesson) => (
            <div key={lesson.id}>
              <dt>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => open(lesson.id)}
                >
                  {lesson.id} · {lesson.title}
                </button>
              </dt>
              <dd>
                <MathText text={lesson.theorem} />
                <details>
                  <summary>Conditions</summary>
                  <ul>
                    {lesson.hypotheses.map((condition) => (
                      <li key={condition}>
                        <MathText text={condition} />
                      </li>
                    ))}
                  </ul>
                </details>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="distribution-grid">
          {families.map((family) => (
            <article className="distribution-card" key={family.name}>
              <h2>{family.name}</h2>
              <p>
                <MathText text={family.parameters} />
              </p>
              <dl>
                {[
                  ['Support', family.support],
                  ['Mass or density', family.formula],
                  ['Mean', family.mean],
                  ['Variance', family.variance],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <MathText text={value} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="distribution-caution">
                <MathText text={family.caution} />
              </p>
              <button
                type="button"
                className="text-link"
                onClick={() => open(family.lessonId)}
              >
                Open lesson {family.lessonId}
              </button>
            </article>
          ))}
        </div>
      )}
      {!(tab === 'results' ? resultLessons.length : families.length) && (
        <p role="status">No matching entries. Try another name or condition.</p>
      )}
    </div>
  );
}
