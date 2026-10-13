import { lessons } from './content/lessons';

export const views = ['learn', 'practice', 'reference'] as const;
export type View = (typeof views)[number];
export type Route =
  | { view: View; lessonId: null }
  | { view: 'lesson'; lessonId: string }
  | { view: 'not-found'; lessonId: string | null };

const known = new Set(lessons.map((lesson) => lesson.id));
const slug = (title: string) =>
  title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function lessonPath(id: string): string {
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson) throw new Error('Unknown lesson ID.');
  return `/lessons/${id.toLowerCase()}-${slug(lesson.title)}`;
}

export function viewPath(view: View): string {
  return view === 'learn' ? '/' : `/${view}`;
}

export function routeFromLocation(pathname: string): Route {
  const match = /^\/lessons\/([a-z][0-9]{2})(?:-[a-z0-9-]+)?\/?$/i.exec(
    pathname,
  );
  if (match) {
    const id = match[1].toUpperCase();
    return known.has(id)
      ? { view: 'lesson', lessonId: id }
      : { view: 'not-found', lessonId: id };
  }
  if (pathname === '/' || pathname === '')
    return { view: 'learn', lessonId: null };
  const name = pathname.replace(/^\/|\/$/g, '');
  if ((views as readonly string[]).includes(name))
    return { view: name as View, lessonId: null };
  return { view: 'not-found', lessonId: null };
}
