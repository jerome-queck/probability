import { useSyncExternalStore } from 'react';
import { lessons } from './content/lessons';
import { nextUnstudied, progressStore } from './progress';
import type { View } from './routes';
import { CourseReference, PracticeSession } from './StudyViews';
import { studyStore } from './state';

const clusters = [...new Set(lessons.map((lesson) => lesson.cluster))];

export function AtlasViews({
  view,
  open,
}: {
  view: View;
  open: (id: string) => void;
}) {
  const progress = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
  );
  const order = lessons.map((l) => l.id);
  const started = order.some((id) => progress.studied.includes(id));
  const continueId = started ? nextUnstudied(order, progress) : undefined;
  if (view === 'practice') return <PracticeSession />;
  if (view === 'reference') return <CourseReference open={open} />;
  return (
    <div className="overview-shell">
      <section className="atlas-hero">
        <div className="hero-copy">
          <p className="eyebrow">A FIRST COURSE IN PROBABILITY</p>
          <h1 tabIndex={-1}>
            Learn to reason
            <br />
            <em>under uncertainty.</em>
          </h1>
          <p>
            Build a model, check its conditions, and follow the reasoning. Study
            definitions, proofs and worked examples across the course, then test
            your intuition in six experiments. Quoted results are labeled.
          </p>
          <div className="hero-actions">
            {continueId ? (
              <button type="button" onClick={() => open(continueId)}>
                Continue with {continueId} <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button type="button" onClick={() => open(lessons[0].id)}>
                {started
                  ? 'Every lesson studied: start again'
                  : 'Begin at the beginning'}{' '}
                <span aria-hidden="true">→</span>
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => studyStore.openView('practice')}
            >
              Practise problems
            </button>
          </div>
        </div>
        <HeroFigure />
      </section>
      <section className="study-dashboard" aria-label="Study overview">
        <div>
          <strong>
            {order.filter((id) => progress.studied.includes(id)).length} of{' '}
            {lessons.length}
          </strong>
          <span>lessons marked as studied</span>
        </div>
        <div>
          <strong>
            {order.filter((id) => progress.practice[id] === 'review').length}
          </strong>
          <span>practice problems to revisit</span>
        </div>
        <p>
          Study marks and practice ratings are your own record, not an
          assessment of mastery.
        </p>
      </section>
      <details className="course-scope">
        <summary>Course scope and preparation</summary>
        <p>
          Start with algebra, sets, and sums. The continuous chapters use
          derivatives and integrals. Joint densities and transformations also
          use double integrals and Jacobians. Each lesson links its earlier
          concepts.
        </p>
        <p>
          The path covers counting, conditioning, discrete and continuous laws,
          joint distributions, expectation, and limit theorems. Statistical
          inference, measure theory, and a full stochastic-process course are
          beyond this first course. Results quoted without a full proof are
          identified in their lessons.
        </p>
      </details>
      <section className="overview-section" aria-labelledby="chapters-heading">
        <p className="eyebrow">{lessons.length} LESSONS</p>
        <h2 id="chapters-heading">Chapters</h2>
        <div className="chapter-grid">
          {clusters.map((cluster) => {
            const items = lessons.filter(
              (lesson) => lesson.cluster === cluster,
            );
            return (
              <article className="atlas-card" key={cluster}>
                <h3>
                  <span className="chapter-number">
                    {String(clusters.indexOf(cluster) + 1).padStart(2, '0')}
                  </span>
                  {cluster}
                </h3>
                <ChapterProgress
                  done={
                    items.filter((l) => progress.studied.includes(l.id)).length
                  }
                  total={items.length}
                />
                <ul>
                  {items.map((lesson) => (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => open(lesson.id)}
                      >
                        {lesson.id} · {lesson.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// Binomial(12, 1/2) bars with the matching normal curve: the course in one picture.
function HeroFigure() {
  const n = 12;
  const choose = (k: number) => {
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    return c;
  };
  const pmf = Array.from({ length: n + 1 }, (_, k) => choose(k) / 2 ** n);
  const w = 360;
  const h = 200;
  const slot = w / (n + 1);
  const scale = (h - 16) / pmf[6];
  const sd = Math.sqrt(n / 4);
  const curve = Array.from({ length: 121 }, (_, i) => {
    const x = (i / 120) * (n + 1) - 0.5;
    const y =
      Math.exp(-((x - n / 2) ** 2) / (2 * sd * sd)) /
      (sd * Math.sqrt(2 * Math.PI));
    return `${i ? 'L' : 'M'}${((x + 0.5) * slot).toFixed(1)} ${(h - y * scale).toFixed(1)}`;
  }).join(' ');
  return (
    <figure className="hero-figure">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Binomial probabilities for twelve fair coin tosses, with the normal curve that approximates them"
      >
        {pmf.map((p, k) => (
          <rect
            key={k}
            className="bar"
            x={k * slot + 3}
            y={h - p * scale}
            width={slot - 6}
            height={p * scale}
            rx="3"
          />
        ))}
        <path className="curve" d={curve} />
      </svg>
      <figcaption>
        Heads in twelve fair tosses, and the normal curve that the central limit
        theorem predicts.
      </figcaption>
    </figure>
  );
}

function ChapterProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="chapter-progress">
      <div
        className="chapter-progress-bar"
        role="progressbar"
        aria-label="Lessons studied"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} studied`}
      >
        <span style={{ width: `${(100 * done) / total}%` }} />
      </div>
      <small>
        {done} of {total} studied
      </small>
    </div>
  );
}
