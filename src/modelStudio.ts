type Description = Readonly<{ model: string; A: string; B: string }>;
type OutcomeDraft = Readonly<{
  id: number;
  label: string;
  weight: string;
  inA: boolean;
  inB: boolean;
}>;
type Atom = Readonly<Omit<OutcomeDraft, 'weight'> & { weight: number }>;
type Fraction = Readonly<{
  numerator: number;
  denominator: number;
  text: string;
}>;
type Issue = Readonly<{
  id: number | 'model';
  field: 'label' | 'weight' | 'model';
  message: string;
}>;
type Invalid = Readonly<{ kind: 'invalid'; issues: readonly Issue[] }>;
type Valid = Readonly<{
  kind: 'valid';
  total: number;
  a: number;
  b: number;
  ab: number;
  pA: Fraction;
  pB: Fraction;
  pAB: Fraction;
  product: Fraction;
  conditional:
    | { readonly kind: 'defined'; readonly value: Fraction }
    | { readonly kind: 'undefined' };
  relationship: 'independent' | 'dependent';
}>;
type Model = Readonly<{ atoms: readonly Atom[]; reading: Valid }>;
type Parsed = Invalid | Readonly<{ kind: 'model'; model: Model }>;
type Preset = 'balanced' | 'uneven' | 'zero-evidence';
type State = Readonly<{
  rows: readonly OutcomeDraft[];
  description: Description;
  condition: 'whole' | 'B';
  pinned: Readonly<{ model: Model; description: Description }> | null;
  reflection: string;
  nextId: number;
}>;

const visitState = Symbol('model studio visit');
export type StudioVisit = Readonly<{ [visitState]: State }>;
export type StudioCommand =
  | { type: 'set-label' | 'set-weight'; id: number; raw: string }
  | {
      type: 'set-membership';
      id: number;
      event: 'A' | 'B';
      included: boolean;
    }
  | { type: 'set-description'; field: keyof Description; raw: string }
  | { type: 'set-condition'; value: State['condition'] }
  | { type: 'load-example'; id: Preset }
  | { type: 'remove-outcome'; id: number }
  | { type: 'set-reflection'; raw: string }
  | { type: 'add-outcome' | 'pin-current' | 'clear-comparison' | 'start-over' };

function example(id: Preset) {
  const weights =
    id === 'uneven'
      ? ['3', '1', '1', '1']
      : id === 'zero-evidence'
        ? ['1', '0', '3', '0']
        : ['1', '1', '1', '1'];
  return {
    rows: ['HH', 'HT', 'TH', 'TT'].map((label, index) => ({
      id: index + 1,
      label,
      weight: weights[index],
      inA: index < 2,
      inB: id === 'zero-evidence' ? index % 2 === 1 : index % 2 === 0,
    })),
    description: {
      model:
        id === 'uneven'
          ? 'A weighted pair'
          : id === 'zero-evidence'
            ? 'Evidence with no weight'
            : 'Two binary outcomes',
      A: 'First symbol is H',
      B: id === 'zero-evidence' ? 'Second symbol is T' : 'Second symbol is H',
    },
    nextId: 5,
  };
}

export function newStudioVisit(): StudioVisit {
  return {
    [visitState]: {
      ...example('balanced'),
      condition: 'whole',
      pinned: null,
      reflection: '',
    },
  };
}

export function updateStudio(
  visit: StudioVisit,
  command: StudioCommand,
): StudioVisit {
  const state = visit[visitState];
  let next: State;
  switch (command.type) {
    case 'set-label':
    case 'set-weight':
      next = {
        ...state,
        rows: state.rows.map((row) =>
          row.id !== command.id
            ? row
            : {
                ...row,
                [command.type === 'set-label' ? 'label' : 'weight']:
                  command.raw,
              },
        ),
      };
      break;
    case 'set-membership':
      next = {
        ...state,
        rows: state.rows.map((row) =>
          row.id !== command.id
            ? row
            : {
                ...row,
                [command.event === 'A' ? 'inA' : 'inB']: command.included,
              },
        ),
      };
      break;
    case 'set-description':
      next = {
        ...state,
        description: { ...state.description, [command.field]: command.raw },
      };
      break;
    case 'set-condition':
      next = { ...state, condition: command.value };
      break;
    case 'load-example':
      next = { ...state, ...example(command.id) };
      break;
    case 'remove-outcome':
      next =
        state.rows.length === 1
          ? state
          : {
              ...state,
              rows: state.rows.filter((row) => row.id !== command.id),
            };
      break;
    case 'add-outcome': {
      if (state.rows.length === 12) return visit;
      let id = state.nextId;
      while (state.rows.some((row) => row.label.trim() === `Outcome ${id}`))
        id++;
      next = {
        ...state,
        rows: [
          ...state.rows,
          { id, label: `Outcome ${id}`, weight: '1', inA: false, inB: false },
        ],
        nextId: id + 1,
      };
      break;
    }
    case 'pin-current': {
      const parsed = parse(state.rows);
      if (parsed.kind === 'invalid') return visit;
      next = {
        ...state,
        pinned: { model: parsed.model, description: { ...state.description } },
      };
      break;
    }
    case 'clear-comparison':
      next = { ...state, pinned: null };
      break;
    case 'set-reflection':
      next = { ...state, reflection: command.raw };
      break;
    case 'start-over':
      return newStudioVisit();
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
  return { [visitState]: next };
}

export function readStudio(visit: StudioVisit) {
  const state = visit[visitState];
  const parsed = parse(state.rows);
  const current = parsed.kind === 'invalid' ? parsed : parsed.model.reading;
  return {
    rows: state.rows.map((row) => ({
      ...row,
      share:
        current.kind === 'valid'
          ? (Number(row.weight) / current.total) * 100
          : 0,
      issues:
        current.kind === 'invalid'
          ? current.issues.filter((issue) => issue.id === row.id)
          : [],
      contribution:
        state.condition === 'whole'
          ? row.inA
            ? 'Numerator and denominator'
            : 'Denominator only'
          : !row.inB
            ? 'Excluded'
            : row.inA
              ? 'Numerator and denominator'
              : 'Denominator only',
    })),
    description: state.description,
    condition: state.condition,
    reflection: state.reflection,
    current,
    pinned: state.pinned,
    canAdd: state.rows.length < 12,
    canRemove: state.rows.length > 1,
    note: [
      'Probability model note',
      'This visit only. These conclusions follow from chosen weights, not measured real-world frequencies. This note is not a grade.',
      '',
      describeDraft(
        'Current raw draft',
        state.rows,
        state.description,
        current,
      ),
      `Displayed calculation: ${state.condition === 'B' ? 'A given B' : 'A in the whole model'}`,
      ...(state.pinned
        ? [
            '',
            describeDraft(
              'Pinned comparison',
              state.pinned.model.atoms.map((atom) => ({
                ...atom,
                weight: String(atom.weight),
              })),
              state.pinned.description,
              state.pinned.model.reading,
            ),
          ]
        : []),
      '',
      'What changed, and why?',
      state.reflection,
      '',
    ].join('\n'),
  };
}

function parse(rows: readonly OutcomeDraft[]): Parsed {
  const issues: Issue[] = [];
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.label.trim(), (counts.get(row.label.trim()) ?? 0) + 1);
  const atoms: Atom[] = [];
  for (const row of rows) {
    const label = row.label.trim();
    if (!label || label.length > 24)
      issues.push({
        id: row.id,
        field: 'label',
        message: 'Use an outcome name of 1 to 24 characters.',
      });
    else if ((counts.get(label) ?? 0) > 1)
      issues.push({
        id: row.id,
        field: 'label',
        message: 'Give each distinct outcome a different name.',
      });
    const weight = Number(row.weight);
    if (!/^\d+$/.test(row.weight) || weight > 999)
      issues.push({
        id: row.id,
        field: 'weight',
        message: 'Enter a whole-number weight from 0 to 999.',
      });
    atoms.push({ ...row, label, weight });
  }
  if (issues.length) return { kind: 'invalid', issues };
  let total = 0;
  let a = 0;
  let b = 0;
  let ab = 0;
  for (const atom of atoms) {
    total += atom.weight;
    if (atom.inA) a += atom.weight;
    if (atom.inB) b += atom.weight;
    if (atom.inA && atom.inB) ab += atom.weight;
  }
  if (!total)
    return {
      kind: 'invalid',
      issues: [
        {
          id: 'model',
          field: 'model',
          message:
            'Total weight is 0. Give at least one outcome positive weight.',
        },
      ],
    };
  return {
    kind: 'model',
    model: {
      atoms,
      reading: {
        kind: 'valid',
        total,
        a,
        b,
        ab,
        pA: fraction(a, total),
        pB: fraction(b, total),
        pAB: fraction(ab, total),
        product: fraction(a * b, total * total),
        conditional:
          b === 0
            ? { kind: 'undefined' }
            : { kind: 'defined', value: fraction(ab, b) },
        relationship: ab * total === a * b ? 'independent' : 'dependent',
      },
    },
  };
}

function fraction(numerator: number, denominator: number): Fraction {
  let a = numerator;
  let b = denominator;
  while (b) [a, b] = [b, a % b];
  const n = numerator / a;
  const d = denominator / a;
  return {
    numerator: n,
    denominator: d,
    text: d === 1 ? String(n) : `${n}/${d}`,
  };
}

function describeDraft(
  heading: string,
  rows: readonly OutcomeDraft[],
  description: Description,
  reading: Invalid | Valid,
) {
  return [
    heading,
    `Model: ${JSON.stringify(description.model)}`,
    `A: ${JSON.stringify(description.A)}`,
    `B: ${JSON.stringify(description.B)}`,
    ...rows.map(
      (row) =>
        `${JSON.stringify(row.label)}: raw weight ${JSON.stringify(row.weight)}; ${row.inA ? 'in A' : 'outside A'}; ${row.inB ? 'in B' : 'outside B'}`,
    ),
    ...(reading.kind === 'invalid'
      ? [
          'Results unavailable. This raw draft does not define a valid model.',
          ...reading.issues.map(
            (issue) =>
              `${issue.id === 'model' ? 'Model' : `Outcome ${rows.findIndex((row) => row.id === issue.id) + 1}, ${issue.field}`}: ${issue.message}`,
          ),
        ]
      : [
          `Total weight: ${reading.total}`,
          `P(A) = ${reading.a}/${reading.total} = ${reading.pA.text}`,
          `P(B) = ${reading.b}/${reading.total} = ${reading.pB.text}`,
          `P(A intersect B) = ${reading.ab}/${reading.total} = ${reading.pAB.text}`,
          `P(A given B) ${reading.conditional.kind === 'undefined' ? 'is undefined because B has total weight 0.' : `= ${reading.ab}/${reading.b} = ${reading.conditional.value.text}`}`,
          `P(A)P(B) = ${reading.product.text}`,
          `Exact product check: ${reading.ab} × ${reading.total} ${reading.relationship === 'independent' ? '=' : '≠'} ${reading.a} × ${reading.b}`,
          `A and B are ${reading.relationship} in this model.`,
        ]),
  ].join('\n');
}
