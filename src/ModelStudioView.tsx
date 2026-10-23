import { useEffect, useRef, useState } from 'react';
import {
  readStudio,
  type StudioCommand,
  type StudioVisit,
} from './modelStudio';

type Presentation = ReturnType<typeof readStudio>;
type Reading = Presentation['current'];

export function ModelStudio({
  visit,
  send,
  openLesson,
}: {
  visit: StudioVisit;
  send: (command: StudioCommand) => void;
  openLesson: (id: string) => void;
}) {
  const view = readStudio(visit);
  const [status, setStatus] = useState('');
  const focus = useRef<string | null>(null);
  useEffect(() => {
    if (!focus.current) return;
    const target =
      focus.current === 'last'
        ? document.querySelector<HTMLInputElement>(
            '.studio-outcome:last-child input',
          )
        : document.getElementById(focus.current);
    target?.focus();
    focus.current = null;
  });
  function download() {
    const url = URL.createObjectURL(
      new Blob([view.note], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'probability-model-note.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Model note prepared for download.');
  }
  return (
    <div className="studio-shell">
      <header className="studio-heading">
        <p className="eyebrow">YOUR FINITE MODEL</p>
        <h1 tabIndex={-1}>Model studio</h1>
        <p>
          Choose outcomes and weights. See what changes when you learn that B
          happened.
        </p>
        <p className="studio-lifetime">
          This visit only. Internal navigation keeps your work. Reload, page
          departure or Start over clears it. Download a note to keep a copy.
        </p>
      </header>
      <form onSubmit={(event) => event.preventDefault()}>
        <section className="studio-step" aria-labelledby="studio-build-heading">
          <h2 id="studio-build-heading">1. Build a finite world</h2>
          <fieldset className="studio-presets">
            <legend className="visually-hidden">Starting models</legend>
            {(
              [
                ['balanced', 'Balanced pair'],
                ['uneven', 'Uneven pair'],
                ['zero-evidence', 'Zero-weight evidence'],
              ] as const
            ).map(([id, label]) => (
              <button
                type="button"
                key={id}
                onClick={() => {
                  send({ type: 'load-example', id });
                  setStatus(
                    `${label} loaded. Your pin and reflection are kept.`,
                  );
                }}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <p className="studio-help" id="studio-weight-help">
            Use 1 to 12 distinct outcomes, with whole-number weights from 0 to
            999. Weights need not add to 1.
          </p>
          <div className="studio-outcomes">
            {view.rows.map((row, index) => (
              <fieldset className="studio-outcome" key={row.id}>
                <legend>Outcome {index + 1}</legend>
                <label className="studio-name">
                  Name
                  <input
                    id={`studio-name-${row.id}`}
                    value={row.label}
                    maxLength={24}
                    aria-label={`Name for outcome ${index + 1}`}
                    aria-invalid={row.issues.some(
                      (issue) => issue.field === 'label',
                    )}
                    aria-describedby={
                      row.issues.length ? `studio-issues-${row.id}` : undefined
                    }
                    onChange={(event) =>
                      send({
                        type: 'set-label',
                        id: row.id,
                        raw: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="studio-weight">
                  Weight
                  <input
                    value={row.weight}
                    inputMode="numeric"
                    type="text"
                    aria-label={`Weight for outcome ${index + 1}`}
                    aria-invalid={row.issues.some(
                      (issue) => issue.field === 'weight',
                    )}
                    aria-describedby={
                      row.issues.length
                        ? `studio-issues-${row.id}`
                        : 'studio-weight-help'
                    }
                    onChange={(event) =>
                      send({
                        type: 'set-weight',
                        id: row.id,
                        raw: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="studio-membership">
                  <input
                    type="checkbox"
                    checked={row.inA}
                    aria-label={`Outcome ${index + 1} belongs to A`}
                    onChange={(event) =>
                      send({
                        type: 'set-membership',
                        id: row.id,
                        event: 'A',
                        included: event.target.checked,
                      })
                    }
                  />
                  In A
                </label>
                <label className="studio-membership">
                  <input
                    type="checkbox"
                    checked={row.inB}
                    aria-label={`Outcome ${index + 1} belongs to B`}
                    onChange={(event) =>
                      send({
                        type: 'set-membership',
                        id: row.id,
                        event: 'B',
                        included: event.target.checked,
                      })
                    }
                  />
                  In B
                </label>
                <button
                  type="button"
                  className="studio-remove"
                  disabled={!view.canRemove}
                  aria-label={`Remove outcome ${index + 1}`}
                  onClick={() => {
                    focus.current = `studio-name-${view.rows[index === 0 ? 1 : index - 1]?.id}`;
                    send({ type: 'remove-outcome', id: row.id });
                  }}
                >
                  Remove
                </button>
                <p className="studio-contribution">
                  {row.contribution}
                  {row.weight === '0' ? ' · zero weight' : ''}
                </p>
                {row.issues.length > 0 && (
                  <ul
                    className="studio-field-issues"
                    id={`studio-issues-${row.id}`}
                  >
                    {row.issues.map((issue) => (
                      <li key={issue.field}>{issue.message}</li>
                    ))}
                  </ul>
                )}
              </fieldset>
            ))}
          </div>
          <button
            type="button"
            disabled={!view.canAdd}
            onClick={() => {
              focus.current = 'last';
              send({ type: 'add-outcome' });
            }}
          >
            Add an outcome
          </button>
          <details className="studio-descriptions">
            <summary>Describe the model and events</summary>
            <p>
              Names describe your choices. Membership checkboxes define A and B.
              The labels HH and HT do not imply fair or independent physical
              tosses.
            </p>
            {(['model', 'A', 'B'] as const).map((field) => (
              <label key={field}>
                {field === 'model' ? 'Model name' : `Event ${field} means`}
                <input
                  value={view.description[field]}
                  maxLength={160}
                  onChange={(event) =>
                    send({
                      type: 'set-description',
                      field,
                      raw: event.target.value,
                    })
                  }
                />
              </label>
            ))}
          </details>
          {view.current.kind === 'invalid' ? (
            <div className="studio-invalid" role="status">
              <strong>Current results unavailable.</strong>
              <ul>
                {view.current.issues.map((issue) => (
                  <li key={`${issue.id}-${issue.field}`}>
                    {issue.id === 'model'
                      ? ''
                      : `Outcome ${view.rows.findIndex((row) => row.id === issue.id) + 1}: `}
                    {issue.message}
                  </li>
                ))}
              </ul>
              <p>Your raw draft and reflection can still be downloaded.</p>
            </div>
          ) : (
            <>
              <figure className="studio-measure">
                <div className="studio-ribbon" aria-hidden="true">
                  {view.rows.map((row) => (
                    <span
                      key={row.id}
                      className={`${row.inA ? 'in-a' : ''} ${row.inB ? 'in-b' : ''}`}
                      style={{ width: `${row.share}%` }}
                    />
                  ))}
                </div>
                <figcaption>
                  Width shows each outcome's share of total weight{' '}
                  {view.current.total}. Blue means A; stripes mean B.
                  Zero-weight outcomes have no width.
                </figcaption>
              </figure>
              <dl
                className="studio-values"
                aria-label="Whole model probabilities"
              >
                <div>
                  <dt>P(A)</dt>
                  <dd>{view.current.pA.text}</dd>
                </div>
                <div>
                  <dt>P(B)</dt>
                  <dd>{view.current.pB.text}</dd>
                </div>
                <div>
                  <dt>P(A ∩ B)</dt>
                  <dd>{view.current.pAB.text}</dd>
                </div>
              </dl>
            </>
          )}
        </section>
        <section
          className="studio-step"
          aria-labelledby="studio-condition-heading"
        >
          <h2 id="studio-condition-heading">2. Keep only the evidence</h2>
          <p>
            A is “{view.description.A}”. B is “{view.description.B}”. Select B
            as evidence to retain only its outcomes.
          </p>
          <fieldset className="studio-condition">
            <legend className="visually-hidden">Calculation denominator</legend>
            <button
              type="button"
              aria-pressed={view.condition === 'whole'}
              onClick={() => send({ type: 'set-condition', value: 'whole' })}
            >
              Whole model
            </button>
            <button
              type="button"
              aria-pressed={view.condition === 'B'}
              onClick={() => send({ type: 'set-condition', value: 'B' })}
            >
              Condition on B
            </button>
          </fieldset>
          <div
            className="studio-calculation"
            aria-live="polite"
            aria-atomic="true"
          >
            {view.current.kind === 'invalid' ? (
              <p>Finish the model above to calculate probabilities.</p>
            ) : view.condition === 'whole' ? (
              <>
                <p className="studio-equation">
                  P(A) = {view.current.a}/{view.current.total} ={' '}
                  {view.current.pA.text}
                </p>
                <p>
                  {view.current.a} units belong to A, out of{' '}
                  {view.current.total} in the whole model.
                </p>
              </>
            ) : view.current.conditional.kind === 'undefined' ? (
              <>
                <p className="studio-equation">P(A | B) is undefined.</p>
                <p>
                  B has total weight 0. There is no conditional model to
                  normalize. A nonempty event can still have probability 0.
                </p>
              </>
            ) : (
              <>
                <p className="studio-equation">
                  P(A | B) = {view.current.ab}/{view.current.b} ={' '}
                  {view.current.conditional.value.text}
                </p>
                <p>
                  {view.current.ab} units belong to both A and B. Divide by the{' '}
                  {view.current.b} units retained in B.
                </p>
              </>
            )}
          </div>
          <p className="studio-help">
            When B has positive total weight, its retained outcomes must
            together have probability 1. Divide each retained weight by B's
            total weight. If B has weight 0, conditioning is undefined. The
            original model stays unchanged.
          </p>
        </section>
        <section
          className="studio-step"
          aria-labelledby="studio-compare-heading"
        >
          <h2 id="studio-compare-heading">3. Change one assumption</h2>
          <p>
            Pin the balanced model, then change HH's weight to 3. Does knowing B
            change the chance of A?
          </p>
          <div className="studio-independence">
            <Independence reading={view.current} />
          </div>
          <div className="studio-actions">
            <button
              type="button"
              id="studio-pin"
              disabled={view.current.kind === 'invalid'}
              onClick={() => {
                send({ type: 'pin-current' });
                setStatus(
                  'Comparison pinned for this visit. Later edits keep its values fixed.',
                );
              }}
            >
              {view.pinned ? 'Replace pinned model' : 'Pin this model'}
            </button>
            {view.pinned && (
              <button
                type="button"
                onClick={() => {
                  focus.current = 'studio-pin';
                  send({ type: 'clear-comparison' });
                  setStatus(
                    'Comparison cleared. Current work and reflection are kept.',
                  );
                }}
              >
                Clear comparison
              </button>
            )}
          </div>
          {view.pinned ? (
            <Comparison view={view} />
          ) : (
            <p className="studio-help">No comparison pinned yet.</p>
          )}
          <label className="studio-reflection" htmlFor="studio-reflection">
            What changed, and why?
          </label>
          <textarea
            id="studio-reflection"
            rows={3}
            value={view.reflection}
            placeholder="Explain which weights or memberships changed the numerator and denominator."
            onChange={(event) =>
              send({ type: 'set-reflection', raw: event.target.value })
            }
          />
          <div className="studio-actions">
            <button
              type="button"
              className="studio-download"
              onClick={download}
            >
              Download model note
            </button>
            <button
              type="button"
              onClick={() => {
                focus.current = 'studio-name-1';
                send({ type: 'start-over' });
                setStatus(
                  'Started over. The draft, comparison and reflection are reset.',
                );
              }}
            >
              Start over
            </button>
          </div>
          <p className="studio-help">
            The note includes your raw draft, exact results when available,
            comparison and reflection. Your account stores no Studio work.
            Signing in or out can leave this page and clear the visit.
          </p>
          <p className="studio-status" role="status">
            {status}
          </p>
        </section>
      </form>
      <footer className="studio-footer">
        <p>
          These conclusions follow from your chosen weights. They do not
          establish how a real experiment behaves. Your reflection is your
          record, not a grade.
        </p>
        <p>
          Read the reasoning in{' '}
          <button
            type="button"
            className="text-link"
            onClick={() => openLesson('F01')}
          >
            sample spaces and events
          </button>
          ,{' '}
          <button
            type="button"
            className="text-link"
            onClick={() => openLesson('K01')}
          >
            conditional probability
          </button>
          , and{' '}
          <button
            type="button"
            className="text-link"
            onClick={() => openLesson('K04')}
          >
            independence
          </button>
          .
        </p>
      </footer>
    </div>
  );
}

function Independence({ reading }: { reading: Reading }) {
  if (reading.kind === 'invalid')
    return <p>Independence is unavailable until the model is valid.</p>;
  return (
    <>
      <p>
        <strong>A and B are {reading.relationship} in this model.</strong>
      </p>
      <p>The product criterion uses the original model.</p>
      <p className="studio-equation">
        P(A ∩ B) = {reading.pAB.text}
        <br />
        P(A)P(B) = {reading.product.text}
      </p>
      <p>
        Exact integer check: {reading.ab} × {reading.total}{' '}
        {reading.relationship === 'independent' ? '=' : '≠'} {reading.a} ×{' '}
        {reading.b}.
      </p>
      <p>
        {reading.b === 0
          ? 'The product criterion still applies when P(B) = 0. P(A | B) remains undefined.'
          : `Knowing B ${reading.relationship === 'independent' ? 'does not change' : 'changes'} the probability of A.`}
      </p>
    </>
  );
}

function Comparison({ view }: { view: Presentation }) {
  if (!view.pinned) return null;
  const before = view.pinned.model.reading;
  const now = view.current;
  const values = (reading: Reading) =>
    reading.kind === 'invalid'
      ? [
          'Unavailable',
          'Unavailable',
          'Unavailable',
          'Unavailable',
          'Unavailable',
        ]
      : [
          reading.pA.text,
          reading.pB.text,
          reading.pAB.text,
          reading.conditional.kind === 'defined'
            ? reading.conditional.value.text
            : 'Undefined',
          reading.relationship,
        ];
  const oldValues = values(before);
  const newValues = values(now);
  return (
    <div className="studio-comparison">
      <h3>Pinned and current models</h3>
      <p>
        <strong>Pinned</strong> “{view.pinned.description.model}”. A means “
        {view.pinned.description.A}”; B means “{view.pinned.description.B}”.
      </p>
      <p>
        <strong>Current</strong> “{view.description.model}”. A means “
        {view.description.A}”; B means “{view.description.B}”.
      </p>
      <table>
        <caption>
          Matching quantities in each model. The pinned values stay fixed.
        </caption>
        <thead>
          <tr>
            <th scope="col">Quantity</th>
            <th scope="col">Pinned</th>
            <th scope="col">Current</th>
          </tr>
        </thead>
        <tbody>
          {['P(A)', 'P(B)', 'P(A ∩ B)', 'P(A | B)', 'Relationship'].map(
            (label, index) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{oldValues[index]}</td>
                <td>{newValues[index]}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
