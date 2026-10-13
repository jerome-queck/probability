import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { lessons } from './content/lessons';
import { lessonMatches } from './content/search';
import { lessonPath } from './routes';
import { studyStore } from './state';

const clusters = [...new Set(lessons.map((lesson) => lesson.cluster))];
const preferenceKey = 'probability.navigation.v1';
function savedChapters(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(preferenceKey) ?? '[]',
    );
    return Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === 'string' && clusters.includes(item),
        )
      : [];
  } catch {
    return [];
  }
}
function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLocaleLowerCase().indexOf(query);
  if (!query || index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}
export function Sidebar({
  drawer,
  hiddenOffscreen,
  onClose,
  onSelect,
}: {
  drawer: boolean;
  hiddenOffscreen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const state = useSyncExternalStore(
    studyStore.subscribe,
    studyStore.getSnapshot,
  );
  const active =
    state.view === 'lesson'
      ? lessons.find((lesson) => lesson.id === state.lessonId)
      : undefined;
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>(savedChapters);
  // Opening a lesson expands its chapter once; after that the reader can collapse it.
  const activeCluster = active?.cluster;
  useEffect(() => {
    if (activeCluster)
      setExpanded((current) =>
        current.includes(activeCluster) ? current : [...current, activeCluster],
      );
  }, [activeCluster]);
  useEffect(() => {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(expanded));
    } catch {
      // Navigation remains available when storage is blocked.
    }
  }, [expanded]);
  const normalized = query.trim().toLocaleLowerCase();
  const found = useMemo(
    () => lessons.filter((lesson) => lessonMatches(normalized, lesson)),
    [normalized],
  );
  function toggle(cluster: string) {
    setExpanded((current) =>
      current.includes(cluster)
        ? current.filter((item) => item !== cluster)
        : [...current, cluster],
    );
  }
  return (
    <aside
      id="lesson-sidebar"
      className={`sidebar ${drawer ? 'open' : ''}`}
      inert={hiddenOffscreen}
      aria-label="Lesson navigation"
    >
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <title>Probability mark</title>
            <rect
              x="6"
              y="6"
              width="52"
              height="52"
              rx="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <circle cx="20" cy="20" r="5" />
            <circle cx="32" cy="32" r="5" />
            <circle cx="44" cy="44" r="5" />
          </svg>
        </span>
        <div>
          <strong>Probability</strong>
          <small>A first course</small>
        </div>
      </div>
      <button
        type="button"
        className="drawer-close"
        onClick={onClose}
        aria-label="Close lessons"
      >
        ×
      </button>
      <label className="search-label" htmlFor="lesson-search">
        Find a concept
      </label>
      <input
        id="lesson-search"
        className="search"
        type="search"
        placeholder="ID, idea, distribution…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="search-status" aria-live="polite">
        {normalized
          ? `${found.length} matching ${found.length === 1 ? 'lesson' : 'lessons'}`
          : 'Browse by chapter'}
      </div>
      <nav className="lesson-nav" aria-label="Chapters and lessons">
        {normalized && found.length === 0 && (
          <div className="search-empty">
            No lessons found for “{query}”.{' '}
            <button type="button" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        )}
        {clusters.map((cluster, index) => {
          const visible = normalized
            ? found.filter((lesson) => lesson.cluster === cluster)
            : lessons.filter((lesson) => lesson.cluster === cluster);
          if (visible.length === 0) return null;
          const open = Boolean(normalized) || expanded.includes(cluster);
          const panelId = `chapter-${index}`;
          return (
            <section className="chapter" key={cluster}>
              <h2 className="chapter-heading">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(cluster)}
                >
                  <span>{cluster}</span>
                  <span className="chapter-count">{visible.length}</span>
                  <span className="chapter-chevron" aria-hidden="true">
                    ⌄
                  </span>
                </button>
              </h2>
              <div id={panelId} hidden={!open}>
                {visible.map((lesson) => (
                  <a
                    key={lesson.id}
                    href={lessonPath(lesson.id)}
                    className={`nav-link ${state.view === 'lesson' && lesson.id === active?.id ? 'active' : ''}`}
                    aria-current={
                      state.view === 'lesson' && lesson.id === active?.id
                        ? 'page'
                        : undefined
                    }
                    onClick={(event) => {
                      if (
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      onSelect(lesson.id);
                    }}
                  >
                    <span>{lesson.id}</span>
                    <Highlight text={lesson.title} query={normalized} />
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </nav>
      <div className="side-foot">
        Original lessons · Checked mathematics
        <br />
        Textbook references appear in each lesson.
      </div>
    </aside>
  );
}
