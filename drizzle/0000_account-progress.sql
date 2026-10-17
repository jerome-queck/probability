CREATE TABLE `lesson_progress` (
	`owner` text NOT NULL,
	`lesson_id` text NOT NULL,
	`studied` integer DEFAULT false NOT NULL,
	`verdict` text,
	`reviewed_at` integer,
	`revision` integer NOT NULL,
	`last_mutation_id` text NOT NULL,
	PRIMARY KEY(`owner`, `lesson_id`),
	CONSTRAINT "studied_boolean" CHECK("lesson_progress"."studied" IN (0, 1)),
	CONSTRAINT "verdict_allowed" CHECK("lesson_progress"."verdict" IS NULL OR "lesson_progress"."verdict" IN ('got-it', 'review')),
	CONSTRAINT "revision_positive" CHECK("lesson_progress"."revision" > 0),
	CONSTRAINT "review_time" CHECK(("lesson_progress"."verdict" IS NULL AND "lesson_progress"."reviewed_at" IS NULL) OR ("lesson_progress"."verdict" IS NOT NULL AND "lesson_progress"."reviewed_at" IS NOT NULL AND "lesson_progress"."reviewed_at" >= 0))
);
