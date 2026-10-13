import { lessons } from './content/lessons';
import { Practice } from './LessonPage';
import { MathText } from './MathText';
import type { View } from './routes';
import { studyStore } from './state';

const clusters = [...new Set(lessons.map((lesson) => lesson.cluster))];

export function AtlasViews({
  view,
  open,
}: {
  view: View;
  open: (id: string) => void;
}) {
  if (view === 'practice')
    return (
      <div className="overview-shell">
        <header className="overview-heading">
          <p className="eyebrow">PRACTICE</p>
          <h1 tabIndex={-1}>One problem per lesson</h1>
          <p>Try each problem before opening the hints.</p>
        </header>
        <div className="practice-list">
          {lessons.map((lesson) => (
            <Practice key={lesson.id} lesson={lesson} embedded />
          ))}
        </div>
      </div>
    );
  if (view === 'reference')
    return (
      <div className="overview-shell">
        <header className="overview-heading">
          <p className="eyebrow">REFERENCE</p>
          <h1 tabIndex={-1}>Every result on one page</h1>
        </header>
        {clusters.map((cluster) => (
          <section className="overview-section" key={cluster}>
            <h2>{cluster}</h2>
            <dl className="reference-list">
              {lessons
                .filter((lesson) => lesson.cluster === cluster)
                .map((lesson) => (
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
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </div>
    );
  return (
    <div className="overview-shell">
      <section className="atlas-hero">
        <div className="hero-copy">
          <p className="eyebrow">AN INTERACTIVE PROBABILITY COURSE</p>
          <h1 tabIndex={-1}>
            Uncertain outcomes.
            <br />
            <em>Exact reasoning.</em>
          </h1>
          <p>
            Count carefully, condition honestly, and watch averages settle. A
            first course in probability, from sample spaces to the central limit
            theorem.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => open(lessons[0].id)}>
              Begin at the beginning <span aria-hidden="true">↗</span>
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => studyStore.openView('practice')}
            >
              Practise <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
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
                <h3>{cluster}</h3>
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
