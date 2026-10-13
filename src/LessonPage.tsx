import { lazy, Suspense, useState, useSyncExternalStore } from 'react';
import { lessons } from './content/lessons';
import type { Lesson } from './content/types';
import { MathText } from './MathText';
import { progressStore } from './progress';

const Labs = lazy(() => import('./Labs'));

export function LessonPage({
  lesson,
  onSelect,
}: {
  lesson: Lesson;
  onSelect: (id: string) => void;
}) {
  const index = lessons.findIndex((item) => item.id === lesson.id);
  const previous = lessons[index - 1];
  const next = lessons[index + 1];
  const titleOf = (id: string) =>
    lessons.find((item) => item.id === id)?.title ?? 'Prerequisite';
  return (
    <div className="reading-shell" data-lesson-id={lesson.id}>
      <div className="breadcrumb">
        Lessons <span>/</span> {lesson.cluster} <span>/</span> {lesson.id}
      </div>
      <div className="lesson-head">
        <div>
          <p className="eyebrow">
            {lesson.id} · {lesson.cluster}
          </p>
          <h1 id="lesson-heading" tabIndex={-1}>
            {lesson.title}
          </h1>
          <p className="question">
            <MathText text={lesson.question} />
          </p>
          <p className="summary">
            <MathText text={lesson.summary} />
          </p>
        </div>
      </div>
      <div className="lesson-preparation">
        <span>Builds on</span>
        {lesson.prerequisites.length ? (
          lesson.prerequisites.map((id) => (
            <button type="button" key={id} onClick={() => onSelect(id)}>
              {id} · {titleOf(id)}
            </button>
          ))
        ) : (
          <span>No prior lessons needed</span>
        )}
      </div>
      <div className="reading-grid">
        <article className="lesson-body">
          <section id="intuition" className="content-section intuition-section">
            <span className="callout-label">THE IDEA TO HOLD ON TO</span>
            <p>
              <MathText text={lesson.intuition} />
            </p>
          </section>
          <section id="definition" className="content-section">
            <h2>Start with the definition</h2>
            {lesson.definition.map((text) => (
              <p key={text}>
                <MathText text={text} />
              </p>
            ))}
          </section>
          <section id="theorem" className="content-section">
            <h2>The claim</h2>
            <div className="theorem">
              <div className="callout-label">THEOREM</div>
              <p>
                <MathText text={lesson.theorem} />
              </p>
            </div>
            <div className="hypotheses">
              <h3>Keep these conditions in view</h3>
              <ul>
                {lesson.hypotheses.map((text) => (
                  <li key={text}>
                    <MathText text={text} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section id="proof" className="content-section">
            <h2>Why it is true</h2>
            <ol className="worked-steps">
              {lesson.proof.map((text) => (
                <li key={text}>
                  <span className="step-text">
                    <MathText text={text} />
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section id="example" className="content-section">
            <h2>Worked example</h2>
            <p className="section-lead">
              <MathText text={lesson.example.prompt} />
            </p>
            <ol className="worked-steps">
              {lesson.example.steps.map((text) => (
                <li key={text}>
                  <span className="step-text">
                    <MathText text={text} />
                  </span>
                </li>
              ))}
            </ol>
            <p className="result-line">
              <MathText text={lesson.example.conclusion} />
            </p>
          </section>
          {lesson.lab && (
            <div className="lesson-lab-slot">
              <Suspense fallback={<p>Loading experiment…</p>}>
                <Labs id={lesson.lab} />
              </Suspense>
            </div>
          )}
          <Practice lesson={lesson} />
          <section id="boundary" className="content-section">
            <h2>Watch the boundary</h2>
            <p>
              <MathText text={lesson.caution} />
            </p>
          </section>
          {lesson.bridge && (
            <section id="bridge" className="content-section bridge">
              <span className="callout-label">LOOKING AHEAD</span>
              <p>
                <MathText text={lesson.bridge} />
              </p>
            </section>
          )}
          <footer className="lesson-footer">
            <h2>Reference</h2>
            <p>
              <MathText text={lesson.reference} />
            </p>
            <p>Explanations, proofs and examples are written for this site.</p>
          </footer>
          <StudiedToggle id={lesson.id} />
          <nav className="lesson-pagination" aria-label="Lesson order">
            {previous && (
              <button
                type="button"
                className="previous-lesson"
                onClick={() => onSelect(previous.id)}
              >
                ← {previous.id} · {previous.title}
              </button>
            )}
            {next && (
              <button
                type="button"
                className="next-lesson"
                onClick={() => onSelect(next.id)}
              >
                {next.id} · {next.title} →
              </button>
            )}
          </nav>
        </article>
        <aside className="context-rail" aria-label="On this lesson">
          <div className="rail-inner">
            <span className="rail-heading">ON THIS LESSON</span>
            <a href="#definition">Definition</a>
            <a href="#theorem">The claim</a>
            <a href="#proof">Proof</a>
            <a href="#example">Worked example</a>
            {lesson.lab && <a href="#lab">Experiment</a>}
            <a href="#practice">Practice</a>
            <div className="rail-divider" />
            <span className="rail-heading">BEFORE THIS</span>
            {lesson.prerequisites.length ? (
              lesson.prerequisites.map((id) => (
                <button type="button" key={id} onClick={() => onSelect(id)}>
                  {id} · {titleOf(id)}
                </button>
              ))
            ) : (
              <p>Start here</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function Practice({
  lesson,
  embedded = false,
}: {
  lesson: Lesson;
  embedded?: boolean;
}) {
  const [hints, setHints] = useState(0);
  const [answer, setAnswer] = useState(false);
  return (
    <section
      id={embedded ? `practice-${lesson.id}` : 'practice'}
      className="content-section practice"
    >
      <span className="callout-label">YOUR TURN</span>
      <h2>{embedded ? `${lesson.id} · ${lesson.title}` : 'Test the idea'}</h2>
      <p>
        <MathText text={lesson.practice.prompt} />
      </p>
      {lesson.practice.hints.slice(0, hints).map((hint, i) => (
        <p className="hint" key={hint}>
          <strong>Hint {i + 1}. </strong>
          <MathText text={hint} />
        </p>
      ))}
      <div className="practice-actions">
        {hints < lesson.practice.hints.length && (
          <button type="button" onClick={() => setHints(hints + 1)}>
            Show a hint
          </button>
        )}
        <button
          type="button"
          className="secondary"
          aria-expanded={answer}
          onClick={() => setAnswer(!answer)}
        >
          {answer ? 'Hide answer' : 'Show answer'}
        </button>
      </div>
      {answer && (
        <p className="answer">
          <MathText text={lesson.practice.answer} />
        </p>
      )}
      {answer && <SelfCheck id={lesson.id} />}
    </section>
  );
}

function useProgress() {
  return useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
  );
}

// After reading the answer the reader records how it went; "review again" problems are
// listed first on the Practice page.
function SelfCheck({ id }: { id: string }) {
  const verdict = useProgress().practice[id];
  return (
    <fieldset className="self-check">
      <legend className="self-check-label">How did it go?</legend>
      <button
        type="button"
        className="chip"
        aria-pressed={verdict === 'got-it'}
        onClick={() => progressStore.setVerdict(id, 'got-it')}
      >
        ✓ I got it
      </button>
      <button
        type="button"
        className="chip"
        aria-pressed={verdict === 'review'}
        onClick={() => progressStore.setVerdict(id, 'review')}
      >
        ↺ Review again
      </button>
      {verdict && (
        <span className="self-check-saved" aria-live="polite">
          {verdict === 'got-it'
            ? 'Saved. Nice work.'
            : 'Saved. It will be first on the Practice page.'}
        </span>
      )}
    </fieldset>
  );
}

function StudiedToggle({ id }: { id: string }) {
  const studied = useProgress().studied.includes(id);
  return (
    <div className={`studied-toggle ${studied ? 'done' : ''}`}>
      <button
        type="button"
        aria-pressed={studied}
        onClick={() => progressStore.toggleStudied(id)}
      >
        {studied ? '✓ Studied' : 'Mark this lesson as studied'}
      </button>
      <span>
        {studied
          ? 'Shown with a tick in the chapter list. Press again to undo.'
          : 'Progress stays in this browser.'}
      </span>
    </div>
  );
}
