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
          <p className="eyebrow">A FIRST COURSE IN PROBABILITY</p>
          <h1 tabIndex={-1}>
            Learn to reason
            <br />
            <em>under uncertainty.</em>
          </h1>
          <p>
            From counting outcomes to the central limit theorem: every result
            stated with its conditions, proved step by step, worked through an
            example, and tried in an experiment you can control.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => open(lessons[0].id)}>
              Begin at the beginning <span aria-hidden="true">→</span>
            </button>
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
