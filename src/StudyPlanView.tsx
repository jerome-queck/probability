import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { lessons } from './content/lessons';
import type { Lesson } from './content/types';
import { Practice } from './LessonPage';
import { type AccountSnapshot, type Progress, progressStore } from './progress';
import { PracticeSession } from './StudyViews';
import { studyStore } from './state';
import type {
  StudyEvent,
  StudyIntent,
  StudyPlan,
  StudyVisit,
} from './studyPlan';

type PlanControls = {
  visit: StudyVisit;
  send: (event: StudyEvent) => void;
};

const chapters = [...new Set(lessons.map((lesson) => lesson.cluster))];
const destinations = lessons.filter((lesson) =>
  ['K03', 'D04', 'L04'].includes(lesson.id),
);

function useRecords() {
  const account = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getAccountSnapshot,
  );
  const progress = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
  );
  return { account, progress };
}

export function StudyPlanEntry({ visit, send }: PlanControls) {
  const { account, progress } = useRecords();
  const ready = account.kind === 'account' || account.kind === 'guest';
  return (
    <section className="study-plan-entry" aria-labelledby="home-plan-heading">
      <div className="plan-section-heading">
        <div>
          <p className="eyebrow">A DIRECTION FOR YOUR NEXT VISIT</p>
          <h2 id="home-plan-heading">What would you like to understand?</h2>
        </div>
        <span className="plan-wordmark" aria-hidden="true">
          Read → Recall
        </span>
      </div>
      {!ready ? (
        <RecordNotice account={account} progress={progress} />
      ) : visit.kind === 'choose' ||
        visit.kind === 'invalid-goal' ||
        visit.kind === 'empty-review' ? (
        <GoalChooser
          onBuild={(intent, size) => {
            send({ kind: 'build', intent, progress, size });
            studyStore.openView('practice');
          }}
        />
      ) : (
        <div className="plan-resume">
          <div>
            <p className="plan-kicker">
              {visit.kind === 'recall' ? 'A SET IS OPEN' : 'YOUR PLAN IS HERE'}
            </p>
            <h3>{planTitle(visit.plan)}</h3>
            <p>Your captured path stays with this visit while you read.</p>
          </div>
          <div className="plan-actions">
            <button
              type="button"
              className="plan-primary"
              onClick={() => studyStore.openView('practice')}
            >
              {visit.kind === 'recall'
                ? 'Continue set'
                : visit.kind === 'summary'
                  ? 'Open set summary'
                  : visit.plan.intent.kind === 'topic'
                    ? 'Open topic path'
                    : 'Open review plan'}
            </button>
            <button
              type="button"
              className="study-button"
              onClick={() => send({ kind: 'choose-another' })}
            >
              Choose another plan
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function StudyPlanView({
  visit,
  send,
  openLesson,
}: PlanControls & { openLesson: (id: string) => void }) {
  const { account, progress } = useRecords();
  const focusAfter = useRef(false);
  const ready = account.kind === 'account' || account.kind === 'guest';
  useEffect(() => {
    if (!focusAfter.current) return;
    focusAfter.current = false;
    const id =
      visit.kind === 'recall'
        ? `recall-heading-${visit.cursor.current.id}`
        : visit.kind === 'summary'
          ? 'study-summary-heading'
          : 'study-plan-heading';
    document.getElementById(id)?.focus();
  }, [visit]);
  function act(event: StudyEvent) {
    focusAfter.current = true;
    send(event);
  }
  return (
    <div className="overview-shell study-workspace">
      <header className="overview-heading plan-page-heading">
        <p className="eyebrow">READ WITH A GOAL. RECALL WITH ROOM TO THINK.</p>
        <h1 id="study-plan-heading" tabIndex={-1}>
          Guided study
        </h1>
        <p>
          Follow the ideas a topic needs, then recall a small set of problems at
          your own pace.
        </p>
      </header>
      <RecordNotice account={account} progress={progress} />
      <section
        className="plan-workspace"
        aria-label="Guided study plan"
        data-study-state={ready ? visit.kind : account.kind}
      >
        {!ready ? (
          <div className="plan-message">
            <h2>Your plan is waiting</h2>
            <p>
              Once your account is resolved, build a path from its study marks
              and ratings. Open Progress above to retry or sign in. Public
              lessons and the problem library remain available.
            </p>
          </div>
        ) : visit.kind === 'choose' ||
          visit.kind === 'invalid-goal' ||
          visit.kind === 'empty-review' ? (
          <>
            {visit.kind === 'invalid-goal' && (
              <div className="plan-message" role="status">
                <h2>Choose an available topic</h2>
                <p>
                  “{visit.requested}” is not in the current catalogue. Choose a
                  topic below to build a new path.
                </p>
              </div>
            )}
            {visit.kind === 'empty-review' && (
              <div className="plan-message" role="status">
                <h2>
                  No review marks
                  {visit.chapter ? ` in ${visit.chapter}` : ' yet'}
                </h2>
                <p>
                  After checking a problem, choose Review again to include it in
                  a future review set. Try all chapters, choose a topic, or
                  explore the library below.
                </p>
              </div>
            )}
            <GoalChooser
              onBuild={(intent, size) =>
                act({ kind: 'build', intent, progress, size })
              }
            />
          </>
        ) : visit.kind === 'path' ? (
          <>
            <PlanHeading
              plan={visit.plan}
              onChoose={() => act({ kind: 'choose-another' })}
            />
            <div className="plan-preview-grid">
              <section className="plan-path" aria-labelledby="path-heading">
                <p className="plan-kicker">THE IDEAS, IN ORDER</p>
                <h3 id="path-heading">
                  {visit.plan.intent.kind === 'topic'
                    ? 'Your complete path'
                    : 'Your marked problems'}
                </h3>
                <p>
                  {visit.plan.intent.kind === 'topic'
                    ? 'Every prerequisite is included. Open any lesson to read the full explanation.'
                    : 'Only problems marked Review again when you built this plan. Prerequisites are links for context.'}
                </p>
                <ol className="topic-path">
                  {visit.plan.path.map(({ lesson, reason }, index) => (
                    <li
                      key={lesson.id}
                      className={reason.kind === 'target' ? 'path-target' : ''}
                    >
                      <span className="path-number" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="path-row-copy">
                        {reason.kind === 'target' && (
                          <span className="path-target-label">YOUR TARGET</span>
                        )}
                        <button
                          type="button"
                          className="text-link path-lesson"
                          onClick={() => openLesson(lesson.id)}
                        >
                          {lesson.id} · {lesson.title}
                        </button>
                        <RecordBadges lesson={lesson} progress={progress} />
                        {reason.kind === 'prerequisite' && (
                          <p className="path-reasons">
                            Needed by{' '}
                            {reason.requiredBy.map((dependent, i) => (
                              <span key={dependent.id}>
                                {i > 0 && ', '}
                                <button
                                  type="button"
                                  className="text-link"
                                  title={dependent.title}
                                  onClick={() => openLesson(dependent.id)}
                                >
                                  {dependent.id}
                                </button>
                              </span>
                            ))}
                          </p>
                        )}
                        {reason.kind === 'review' && (
                          <Prerequisites
                            lesson={lesson}
                            openLesson={openLesson}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <Today
                plan={visit.plan}
                progress={progress}
                onStart={() => act({ kind: 'start' })}
                openLesson={openLesson}
              />
            </div>
          </>
        ) : visit.kind === 'recall' ? (
          <>
            <PlanHeading
              plan={visit.plan}
              onChoose={() => act({ kind: 'choose-another' })}
            />
            <div className="recall-session">
              <div className="recall-status">
                <span className="plan-kicker">THIS CAPTURED SET</span>
                <strong>
                  Problem {visit.cursor.before.length + 1} of{' '}
                  {visit.cursor.before.length + 1 + visit.cursor.after.length}
                </strong>
                <span>
                  {visit.remaining.flat().length} problems in later sets
                </span>
              </div>
              <p className="recall-lifetime">
                Your reasoning, hints and answers stay open through ratings and
                Previous / Next. They clear when you leave Practice, close or
                replace this set, or reload. Returning from a lesson keeps the
                plan and your position.
              </p>
              {[
                ...visit.cursor.before,
                visit.cursor.current,
                ...visit.cursor.after,
              ].map((lesson) => (
                <section
                  key={lesson.id}
                  className="recall-panel"
                  hidden={lesson.id !== visit.cursor.current.id}
                  aria-labelledby={`recall-heading-${lesson.id}`}
                >
                  <p className="eyebrow">{lesson.cluster}</p>
                  <h2 id={`recall-heading-${lesson.id}`} tabIndex={-1}>
                    {lesson.id} · {lesson.title}
                  </h2>
                  <button
                    type="button"
                    className="text-link recall-reading"
                    onClick={() => openLesson(lesson.id)}
                  >
                    Read the full lesson →
                  </button>
                  <Practice lesson={lesson} embedded />
                </section>
              ))}
              <nav
                className="recall-navigation"
                aria-label="Recall set navigation"
              >
                <button
                  type="button"
                  className="study-button"
                  disabled={!visit.cursor.before.length}
                  onClick={() =>
                    act({
                      kind: 'previous',
                      expectedId: visit.cursor.current.id,
                    })
                  }
                >
                  ← Previous problem
                </button>
                {visit.cursor.after.length > 0 ? (
                  <button
                    type="button"
                    className="plan-primary"
                    onClick={() =>
                      act({ kind: 'next', expectedId: visit.cursor.current.id })
                    }
                  >
                    Next problem →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="plan-primary"
                    onClick={() =>
                      act({
                        kind: 'finish',
                        expectedId: visit.cursor.current.id,
                      })
                    }
                  >
                    Finish set →
                  </button>
                )}
              </nav>
              {visit.cursor.after.length > 0 && (
                <button
                  type="button"
                  className="text-link close-set"
                  onClick={() =>
                    act({ kind: 'finish', expectedId: visit.cursor.current.id })
                  }
                >
                  Close this set now
                </button>
              )}
              <p className="plan-footnote">
                Move when you are ready. Ratings never move you or replace a
                problem. Closing a set changes no study marks or self-ratings.
              </p>
            </div>
          </>
        ) : (
          <>
            <PlanHeading
              plan={visit.plan}
              onChoose={() => act({ kind: 'choose-another' })}
            />
            <section
              className="plan-summary"
              aria-labelledby="study-summary-heading"
            >
              <span className="summary-symbol" aria-hidden="true">
                ↗
              </span>
              <p className="plan-kicker">A PLACE TO PAUSE</p>
              <h2 id="study-summary-heading" tabIndex={-1}>
                Set closed
              </h2>
              <p>
                These were the problems in this set. Closing it changes no study
                marks or ratings. The records below are your current
                self-ratings.
              </p>
              <ul className="closed-set-list">
                {visit.closed.map((lesson) => (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => openLesson(lesson.id)}
                    >
                      {lesson.id} · {lesson.title}
                    </button>
                    <RecordBadges lesson={lesson} progress={progress} />
                  </li>
                ))}
              </ul>
              {visit.remaining.length ? (
                <div className="next-set-preview">
                  <h3>Next captured set</h3>
                  <LessonNames items={visit.remaining[0] ?? []} />
                  <p>
                    {visit.remaining.flat().length} problems remain across{' '}
                    {visit.remaining.length}{' '}
                    {visit.remaining.length === 1 ? 'set' : 'sets'}.
                    Continuation keeps the membership captured when you built
                    this plan.
                  </p>
                  <button
                    type="button"
                    className="plan-primary"
                    onClick={() => act({ kind: 'start' })}
                  >
                    Start next set →
                  </button>
                </div>
              ) : (
                <p className="plan-final">
                  You reached the end of this captured plan. Choose another goal
                  or refresh it using your current records.
                </p>
              )}
              <div className="plan-actions summary-actions">
                <button
                  type="button"
                  className="study-button"
                  onClick={() =>
                    act({
                      kind: 'build',
                      intent: visit.plan.intent,
                      progress,
                      size: visit.plan.size,
                    })
                  }
                >
                  Refresh from current records
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => act({ kind: 'choose-another' })}
                >
                  Choose another plan
                </button>
              </div>
            </section>
          </>
        )}
      </section>
      {visit.kind !== 'recall' && (
        <>
          <a className="library-jump" href="#problem-library">
            Browse all problems and checkpoints ↓
          </a>
          <PracticeSession />
        </>
      )}
    </div>
  );
}

function GoalChooser({
  onBuild,
}: {
  onBuild: (intent: StudyIntent, size: 3 | 5) => void;
}) {
  const [targetId, setTargetId] = useState('K03');
  const [chapter, setChapter] = useState('all');
  const [size, setSize] = useState<3 | 5>(3);
  return (
    <div className="goal-chooser">
      <form
        className="topic-chooser"
        onSubmit={(event) => {
          event.preventDefault();
          onBuild({ kind: 'topic', targetId }, size);
        }}
      >
        <span className="goal-step" aria-hidden="true">
          A TOPIC TO REACH
        </span>
        <h3>Build a topic path</h3>
        <p>
          See what a topic builds on, find your next reading, and take its
          problems in small sets.
        </p>
        <div className="goal-field">
          <label htmlFor="plan-topic">Topic to understand</label>
          <select
            id="plan-topic"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            {chapters.map((item) => (
              <optgroup key={item} label={item}>
                {lessons
                  .filter((lesson) => lesson.cluster === item)
                  .map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.id} · {lesson.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="popular-topics">
          <span>Try a destination</span>
          {destinations.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              aria-pressed={targetId === lesson.id}
              onClick={() => setTargetId(lesson.id)}
            >
              {lesson.title}
            </button>
          ))}
        </div>
        <div className="goal-submit">
          <div className="goal-field">
            <label htmlFor="plan-size">Problems per set</label>
            <select
              id="plan-size"
              value={size}
              onChange={(event) => setSize(event.target.value === '5' ? 5 : 3)}
            >
              <option value="3">3 problems</option>
              <option value="5">5 problems</option>
            </select>
          </div>
          <button type="submit" className="plan-primary">
            Build topic path →
          </button>
        </div>
      </form>
      <div className="review-chooser">
        <span className="goal-step" aria-hidden="true">
          SOMETHING TO REVISIT
        </span>
        <h3>Review your marks</h3>
        <p>
          Build a fixed set from problems you marked Review again. Later ratings
          will leave the set in place.
        </p>
        <div className="goal-field">
          <label htmlFor="plan-review-chapter">Review chapter</label>
          <select
            id="plan-review-chapter"
            value={chapter}
            onChange={(event) => setChapter(event.target.value)}
          >
            <option value="all">All chapters</option>
            {chapters.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="study-button"
          onClick={() =>
            onBuild(
              { kind: 'review', chapter: chapter === 'all' ? null : chapter },
              size,
            )
          }
        >
          Review marked problems →
        </button>
        <p className="plan-footnote">
          Self-ratings record your judgment. They are not a grade or an
          assessment of mastery.
        </p>
      </div>
    </div>
  );
}

function PlanHeading({
  plan,
  onChoose,
}: {
  plan: StudyPlan;
  onChoose: () => void;
}) {
  return (
    <header className="plan-section-heading plan-title">
      <div>
        <p className="plan-kicker">
          {plan.intent.kind === 'topic' ? 'YOUR TOPIC PATH' : 'GUIDED REVIEW'}
        </p>
        <h2>{planTitle(plan)}</h2>
      </div>
      <button type="button" className="text-link" onClick={onChoose}>
        Choose another plan
      </button>
    </header>
  );
}

function planTitle(plan: StudyPlan) {
  return plan.intent.kind === 'topic'
    ? (plan.path.find((row) => row.reason.kind === 'target')?.lesson.title ??
        'Topic path')
    : (plan.intent.chapter ?? 'Review marked problems');
}

function Today({
  plan,
  progress,
  onStart,
  openLesson,
}: {
  plan: StudyPlan;
  progress: Progress;
  onStart: () => void;
  openLesson: (id: string) => void;
}) {
  const first = plan.recall.slice(0, plan.size);
  const later = plan.recall.length - first.length;
  const target = plan.path.find((row) => row.reason.kind === 'target')?.lesson;
  const deferred = target && !first.some((lesson) => lesson.id === target.id);
  const reading = plan.path.find(
    (row) => !progress.studied.includes(row.lesson.id),
  )?.lesson;
  return (
    <aside className="plan-today" aria-labelledby="today-heading">
      <p className="plan-kicker">A SMALL PLACE TO START</p>
      <h3 id="today-heading">Today</h3>
      <p>
        {first.length} {first.length === 1 ? 'problem' : 'problems'}, one at a
        time. Read first if the ideas are new.
      </p>
      <LessonNames items={first} />
      <button type="button" className="plan-primary" onClick={onStart}>
        Start this set →
      </button>
      <div className="today-later">
        <strong>
          {later
            ? `${later} problems in later sets`
            : 'This set reaches the end of the plan'}
        </strong>
        {deferred && (
          <p>
            Your target, {target.id} · {target.title}, comes in a later captured
            set.
          </p>
        )}
        {later > 0 && (
          <p>
            Continue from each set summary, even if your study marks stay
            unchanged.
          </p>
        )}
      </div>
      {plan.intent.kind === 'topic' && (
        <div className="today-reading">
          <span className="plan-kicker">NEXT READING</span>
          {reading ? (
            <button
              type="button"
              className="text-link"
              onClick={() => openLesson(reading.id)}
            >
              {reading.id} · {reading.title} →
            </button>
          ) : (
            <p>
              Every lesson on this path is marked studied. The target remains
              available for recall.
            </p>
          )}
        </div>
      )}
      <p className="plan-footnote">
        This plan lasts this visit. Reloading, checking your account again, or
        changing accounts clears it. Your saved records stay in Progress.
      </p>
    </aside>
  );
}

function LessonNames({ items }: { items: readonly Lesson[] }) {
  return (
    <ol className="set-lesson-list">
      {items.map((lesson) => (
        <li key={lesson.id}>
          <span>{lesson.id}</span>
          {lesson.title}
        </li>
      ))}
    </ol>
  );
}

function RecordBadges({
  lesson,
  progress,
}: {
  lesson: Lesson;
  progress: Progress;
}) {
  const rating = progress.practice[lesson.id];
  return (
    <div className="plan-records">
      <span
        className={progress.studied.includes(lesson.id) ? 'record-studied' : ''}
      >
        {progress.studied.includes(lesson.id)
          ? 'Marked studied'
          : 'Not marked studied'}
      </span>
      <span className={rating === 'review' ? 'record-review' : ''}>
        {rating === 'got-it'
          ? 'Self-rating: I got it'
          : rating === 'review'
            ? 'Self-rating: Review again'
            : 'No self-rating'}
      </span>
    </div>
  );
}

function Prerequisites({
  lesson,
  openLesson,
}: {
  lesson: Lesson;
  openLesson: (id: string) => void;
}) {
  return (
    <p className="path-reasons">
      {lesson.prerequisites.length ? (
        <>
          Prerequisite context{' '}
          {lesson.prerequisites.map((id, index) => (
            <span key={id}>
              {index > 0 && ', '}
              <button
                type="button"
                className="text-link"
                title={lessons.find((item) => item.id === id)?.title}
                onClick={() => openLesson(id)}
              >
                {id}
              </button>
            </span>
          ))}
        </>
      ) : (
        'No prior lessons needed.'
      )}
    </p>
  );
}

function RecordNotice({
  account,
  progress,
}: {
  account: AccountSnapshot;
  progress: Progress;
}) {
  return (
    <p
      className={`plan-record-notice ${account.kind === 'account' && account.status !== 'saved' ? 'plan-save-notice' : ''}`}
      role="status"
    >
      {account.kind === 'guest'
        ? progress.unsaved
          ? 'Guest changes are not saved. This browser is blocking storage; records last this visit only.'
          : 'Using your guest record in this browser.'
        : account.message}
      {account.kind === 'account' &&
        account.status !== 'saved' &&
        ' Open Progress for save and recovery options.'}
      {(account.kind === 'loading' || account.kind === 'unavailable') &&
        ' Personal planning waits for your account. No guest records are used while it is unresolved.'}
    </p>
  );
}
