import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AccountPanel } from './AccountPanel';
import { AtlasViews } from './AtlasViews';
import { lessons } from './content/lessons';
import { LessonPage } from './LessonPage';
import {
  newStudioVisit,
  type StudioCommand,
  type StudioVisit,
  updateStudio,
} from './modelStudio';
import { progressStore } from './progress';
import { views } from './routes';
import { Sidebar } from './Sidebar';
import { studyStore } from './state';
import { createStudyPlanReducer } from './studyPlan';

const studyPlanReducer = createStudyPlanReducer(lessons);

export function App() {
  const [studio, sendStudio] = useReducer(
    updateStudio,
    undefined,
    newStudioVisit,
  );
  const account = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getAccountSnapshot,
  );
  const owner =
    account.kind === 'account' ? `account:${account.owner}` : account.kind;
  return <Reader key={owner} studio={studio} sendStudio={sendStudio} />;
}

function Reader({
  studio,
  sendStudio,
}: {
  studio: StudioVisit;
  sendStudio: (command: StudioCommand) => void;
}) {
  const [visit, send] = useReducer(studyPlanReducer, { kind: 'choose' });
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
  const narrow = useNarrow();
  const firstRoute = useRef(true);
  // Focus moves only after React has re-rendered, when the target is no longer inert.
  const focusAfter = useRef<'menu' | 'heading' | null>(null);
  function closeDrawer() {
    focusAfter.current = 'menu';
    setDrawer(false);
  }
  const drawerOpen = useRef(false);
  drawerOpen.current = drawer;
  useEffect(() => {
    if (drawer) {
      document.querySelector<HTMLElement>('#lesson-search')?.focus();
      return;
    }
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === 'menu') menuButton.current?.focus();
    if (target === 'heading')
      document
        .querySelector<HTMLElement>('main h1')
        ?.focus({ preventScroll: true });
  }, [drawer]);
  useEffect(() => {
    document.title = lesson
      ? `${lesson.title} · Probability`
      : `${route.view[0].toUpperCase()}${route.view.slice(1)} · Probability`;
    setDrawer(false);
    const anchor = document.getElementById(window.location.hash.slice(1));
    if (anchor) anchor.scrollIntoView({ behavior: 'instant', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
    // Move focus to the new page's heading so keyboard and screen-reader users land on it.
    if (firstRoute.current) firstRoute.current = false;
    else if (drawerOpen.current) focusAfter.current = 'heading';
    else
      document
        .querySelector<HTMLElement>('main h1')
        ?.focus({ preventScroll: true });
  }, [lesson, route.view]);
  useEffect(() => {
    if (!drawer) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        focusAfter.current = 'menu';
        setDrawer(false);
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [drawer]);
  function select(id: string) {
    if (drawer) {
      focusAfter.current = 'heading';
      setDrawer(false);
    }
    studyStore.openLesson(id);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        drawer={drawer}
        hiddenOffscreen={narrow && !drawer}
        onClose={closeDrawer}
        onSelect={select}
      />
      {drawer && (
        <button
          type="button"
          className="scrim"
          onClick={closeDrawer}
          aria-label="Close lesson navigation"
        />
      )}
      <main id="main-content" tabIndex={-1} inert={narrow && drawer}>
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
          <details className="account-menu">
            <summary>Progress</summary>
            <AccountPanel />
          </details>
        </header>
        {route.view === 'not-found' ? (
          <div className="reading-shell">
            <h1 tabIndex={-1}>Page not found</h1>
            <p>That lesson or route is unavailable.</p>
            <button type="button" onClick={() => studyStore.openView('learn')}>
              Return to the start
            </button>
          </div>
        ) : lesson ? (
          <LessonPage key={lesson.id} lesson={lesson} onSelect={select} />
        ) : route.view !== 'lesson' ? (
          <AtlasViews
            view={route.view}
            open={select}
            visit={visit}
            send={send}
            studio={studio}
            sendStudio={sendStudio}
          />
        ) : null}
      </main>
    </div>
  );
}

// Matches the CSS breakpoint where the sidebar becomes a drawer.
const narrowQuery = '(max-width: 860px)';
function useNarrow() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(narrowQuery);
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia(narrowQuery).matches,
  );
}
