import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AtlasViews } from './AtlasViews';
import { lessons } from './content/lessons';
import { LessonPage } from './LessonPage';
import { views } from './routes';
import { Sidebar } from './Sidebar';
import { studyStore } from './state';

export function App() {
  const route = useSyncExternalStore(
    studyStore.subscribe,
    studyStore.getSnapshot,
  );
  const lesson =
    route.view === 'lesson'
      ? lessons.find((item) => item.id === route.lessonId)
      : undefined;
  const [drawer, setDrawer] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    document.title = lesson
      ? `${lesson.title} · Probability`
      : `${route.view[0].toUpperCase()}${route.view.slice(1)} · Probability`;
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [lesson, route.view]);
  useEffect(() => {
    if (!drawer) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawer(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [drawer]);
  function select(id: string) {
    studyStore.openLesson(id);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        drawer={drawer}
        onClose={() => setDrawer(false)}
        onSelect={select}
      />
      {drawer && (
        <button
          type="button"
          className="scrim"
          onClick={() => setDrawer(false)}
          aria-label="Close lesson navigation"
        />
      )}
      <main id="main-content" tabIndex={-1}>
        <header className="topbar">
          <button
            type="button"
            className="menu-button"
            ref={menuButton}
            onClick={() => setDrawer(true)}
            aria-label="Open lessons"
            aria-expanded={drawer}
            aria-controls="lesson-sidebar"
          >
            ☰
          </button>
          <button
            type="button"
            className="topbar-name"
            onClick={() => studyStore.openView('learn')}
          >
            Probability
          </button>
          <nav className="primary-nav" aria-label="Main navigation">
            {views.map((view) => (
              <button
                type="button"
                key={view}
                className={route.view === view ? 'active' : ''}
                aria-current={route.view === view ? 'page' : undefined}
                onClick={() => studyStore.openView(view)}
              >
                {view[0].toUpperCase() + view.slice(1)}
              </button>
            ))}
          </nav>
        </header>
        {route.view === 'not-found' ? (
          <div className="reading-shell">
            <h1>Page not found</h1>
            <p>That lesson or route is unavailable.</p>
            <button type="button" onClick={() => studyStore.openView('learn')}>
              Return to the start
            </button>
          </div>
        ) : lesson ? (
          <LessonPage key={lesson.id} lesson={lesson} onSelect={select} />
        ) : route.view !== 'lesson' ? (
          <AtlasViews view={route.view} open={select} />
        ) : null}
      </main>
    </div>
  );
}
