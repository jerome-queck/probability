import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const lessonProgress = sqliteTable(
  'lesson_progress',
  {
    owner: text('owner').notNull(),
    lessonId: text('lesson_id').notNull(),
    studied: integer('studied', { mode: 'boolean' }).notNull().default(false),
    verdict: text('verdict', { enum: ['got-it', 'review'] }),
    reviewedAt: integer('reviewed_at'),
    revision: integer('revision').notNull(),
    lastMutationId: text('last_mutation_id').notNull(),
  },
  (row) => [
    primaryKey({ columns: [row.owner, row.lessonId] }),
    check('studied_boolean', sql`${row.studied} IN (0, 1)`),
    check(
      'verdict_allowed',
      sql`${row.verdict} IS NULL OR ${row.verdict} IN ('got-it', 'review')`,
    ),
    check('revision_positive', sql`${row.revision} > 0`),
    check(
      'review_time',
      sql`(${row.verdict} IS NULL AND ${row.reviewedAt} IS NULL) OR (${row.verdict} IS NOT NULL AND ${row.reviewedAt} IS NOT NULL AND ${row.reviewedAt} >= 0)`,
    ),
  ],
);
