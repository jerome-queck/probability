import type { D1Database } from '@cloudflare/workers-types';
import lessonIds from '../src/content/order.json' with { type: 'json' };
import type { LessonProgress, ProgressMutation } from '../src/progress.ts';

type TrustedContext = {
  user: { userId: string } | null;
  db?: D1Database;
};
type StoredProgress = {
  lesson_id: string;
  studied: number;
  verdict: 'got-it' | 'review' | null;
  reviewed_at: number | null;
  revision: number;
  last_mutation_id: string;
};

const knownLessons = new Set(lessonIds);
const maxBodyBytes = 2048;
const columns =
  'lesson_id, studied, verdict, reviewed_at, revision, last_mutation_id';

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' },
  });
}

export function handleAccount(context: Pick<TrustedContext, 'user'>) {
  return json(
    context.user
      ? { kind: 'account', owner: context.user.userId }
      : { kind: 'guest' },
  );
}

function record(row: StoredProgress): LessonProgress {
  return {
    lessonId: row.lesson_id,
    studied: row.studied === 1,
    verdict: row.verdict,
    reviewedAt: row.reviewed_at,
    revision: row.revision,
  };
}

function absent(lessonId: string): LessonProgress {
  return {
    lessonId,
    studied: false,
    verdict: null,
    reviewedAt: null,
    revision: 0,
  };
}

class InputError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseMutation(request: Request): Promise<ProgressMutation> {
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new InputError(403, 'same-origin-required');
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw new InputError(415, 'json-required');
  const declaredSize = Number(request.headers.get('content-length') ?? 0);
  if (declaredSize > maxBodyBytes) throw new InputError(413, 'body-too-large');
  if (!Number.isSafeInteger(declaredSize) || declaredSize < 0)
    throw new InputError(400, 'invalid-body');
  if (!request.body) throw new InputError(400, 'invalid-body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  let body: unknown;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        throw new InputError(413, 'body-too-large');
      }
      text += decoder.decode(value, { stream: true });
    }
    body = JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError(400, 'invalid-body');
  } finally {
    reader.releaseLock();
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new InputError(400, 'invalid-mutation');
  if (
    !('lessonId' in body) ||
    typeof body.lessonId !== 'string' ||
    !knownLessons.has(body.lessonId) ||
    !('expectedOwner' in body) ||
    typeof body.expectedOwner !== 'string' ||
    body.expectedOwner.length < 1 ||
    body.expectedOwner.length > 200 ||
    !('expectedRevision' in body) ||
    typeof body.expectedRevision !== 'number' ||
    !Number.isSafeInteger(body.expectedRevision) ||
    body.expectedRevision < 0 ||
    body.expectedRevision >= Number.MAX_SAFE_INTEGER ||
    !('mutationId' in body) ||
    typeof body.mutationId !== 'string' ||
    !/^[A-Za-z0-9_-]{16,80}$/.test(body.mutationId) ||
    !('field' in body) ||
    !('value' in body) ||
    Object.keys(body).some(
      (key) =>
        ![
          'lessonId',
          'expectedOwner',
          'expectedRevision',
          'mutationId',
          'field',
          'value',
        ].includes(key),
    )
  )
    throw new InputError(400, 'invalid-mutation');
  const envelope = {
    lessonId: body.lessonId,
    expectedOwner: body.expectedOwner,
    expectedRevision: body.expectedRevision,
    mutationId: body.mutationId,
  };
  if (body.field === 'studied' && typeof body.value === 'boolean')
    return { ...envelope, field: 'studied', value: body.value };
  if (
    body.field === 'verdict' &&
    (body.value === null || body.value === 'got-it' || body.value === 'review')
  )
    return { ...envelope, field: 'verdict', value: body.value };
  throw new InputError(400, 'invalid-mutation');
}

async function write(
  db: D1Database,
  owner: string,
  mutation: ProgressMutation,
) {
  const { lessonId, expectedRevision, mutationId } = mutation;
  const reviewedAt =
    mutation.field === 'verdict' && mutation.value !== null ? Date.now() : null;
  const updated =
    expectedRevision === 0
      ? await db
          .prepare(`INSERT INTO lesson_progress
        (owner, lesson_id, studied, verdict, reviewed_at, revision, last_mutation_id)
        VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(owner, lesson_id) DO NOTHING RETURNING ${columns}`)
          .bind(
            owner,
            lessonId,
            mutation.field === 'studied' && mutation.value ? 1 : 0,
            mutation.field === 'verdict' ? mutation.value : null,
            reviewedAt,
            mutationId,
          )
          .first<StoredProgress>()
      : await db
          .prepare(`UPDATE lesson_progress SET
        ${mutation.field === 'studied' ? 'studied = ?' : 'verdict = ?, reviewed_at = ?'},
        revision = revision + 1, last_mutation_id = ?
        WHERE owner = ? AND lesson_id = ? AND revision = ? RETURNING ${columns}`)
          .bind(
            ...(mutation.field === 'studied'
              ? [
                  mutation.value ? 1 : 0,
                  mutationId,
                  owner,
                  lessonId,
                  expectedRevision,
                ]
              : [
                  mutation.value,
                  reviewedAt,
                  mutationId,
                  owner,
                  lessonId,
                  expectedRevision,
                ]),
          )
          .first<StoredProgress>();
  if (updated) return json({ owner, record: record(updated) });
  const current = await db
    .prepare(
      `SELECT ${columns} FROM lesson_progress WHERE owner = ? AND lesson_id = ?`,
    )
    .bind(owner, lessonId)
    .first<StoredProgress>();
  if (
    current?.last_mutation_id === mutationId &&
    current.revision === expectedRevision + 1 &&
    (mutation.field === 'studied'
      ? (current.studied === 1) === mutation.value
      : current.verdict === mutation.value)
  )
    return json({ owner, record: record(current) });
  return json(
    {
      error: 'conflict',
      owner,
      record: current ? record(current) : absent(lessonId),
    },
    409,
  );
}

export async function handleProgress(
  request: Request,
  context: TrustedContext,
): Promise<Response> {
  if (!context.user) return json({ error: 'sign-in-required' }, 401);
  if (request.method !== 'GET' && request.method !== 'PATCH')
    return json({ error: 'method-not-allowed' }, 405);
  try {
    const mutation =
      request.method === 'PATCH' ? await parseMutation(request) : null;
    const owner = context.user.userId;
    if (mutation && mutation.expectedOwner !== owner)
      return json({ error: 'account-changed' }, 409);
    if (!context.db) return json({ error: 'storage-unavailable' }, 503);
    if (mutation) return await write(context.db, owner, mutation);
    const rows = await context.db
      .prepare(
        `SELECT ${columns} FROM lesson_progress WHERE owner = ? ORDER BY lesson_id`,
      )
      .bind(owner)
      .all<StoredProgress>();
    return json({ owner, records: rows.results.map(record) });
  } catch (error) {
    if (error instanceof InputError)
      return json({ error: error.message }, error.status);
    return json({ error: 'storage-unavailable' }, 503);
  }
}
