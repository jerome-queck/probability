import {
  lessonPath,
  type Route,
  routeFromLocation,
  type View,
  viewPath,
} from './routes';

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: Route = routeFromLocation(window.location.pathname);

function publish(next: Route, path: string | null) {
  snapshot = next;
  if (path !== null && path !== window.location.pathname)
    window.history.pushState(null, '', path);
  for (const listener of listeners) listener();
}

window.addEventListener('popstate', () =>
  publish(routeFromLocation(window.location.pathname), null),
);

export const studyStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => snapshot,
  openLesson(id: string) {
    publish({ view: 'lesson', lessonId: id }, lessonPath(id));
  },
  openView(view: View) {
    publish({ view, lessonId: null }, viewPath(view));
  },
};
