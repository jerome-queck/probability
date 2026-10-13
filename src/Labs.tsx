import { useMemo, useState } from 'react';
import type { LabId } from './content/types';
import { sharedBirthdayProbability } from './math/counting.ts';
import {
  bayesPosterior,
  binomialPmf,
  binomialSummary,
  normalApproxBinomialPoint,
  normalPdf,
  poissonPmf,
} from './math/distributions.ts';
import {
  histogram,
  runningProportion,
  standardizedUniformSums,
} from './math/simulation.ts';

const fmt = (x: number, digits = 4) => x.toFixed(digits);

function Bars({
  label,
  series,
  max,
}: {
  label: string;
  series: { name: string; values: number[]; className: string }[];
  max: number;
}) {
  const width = 560;
  const height = 180;
  const count = series[0].values.length;
  const slot = width / count;
  return (
    <svg
      viewBox={`0 0 ${width} ${height + 20}`}
      role="img"
      aria-label={label}
      className="lab-chart"
    >
      <title>{label}</title>
      {series.map((s, si) =>
        s.values.map((v, i) => {
          const h = max > 0 ? (v / max) * height : 0;
          const w = slot / (series.length + 0.5);
          return (
            <rect
              key={`${s.name}-${i}`}
              x={i * slot + si * w + w * 0.25}
              y={height - h}
              width={w}
              height={h}
              className={s.className}
            />
          );
        }),
      )}
      <line x1="0" y1={height} x2={width} y2={height} stroke="currentColor" />
    </svg>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  name,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  name: string;
}) {
  return (
    <label className="lab-field">
      {label}
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output data-testid={`${name}-value`}>{value}</output>
    </label>
  );
}

function BirthdayLab() {
  const [n, setN] = useState(23);
  const p = sharedBirthdayProbability(n);
  const curve = Array.from({ length: 60 }, (_, k) =>
    sharedBirthdayProbability(k + 1),
  );
  return (
    <>
      <NumberField
        label="People in the room"
        name="people"
        value={n}
        min={1}
        max={60}
        step={1}
        onChange={setN}
      />
      <p className="result-line" data-testid="lab-result">
        P(at least one shared birthday) = {fmt(p)}
      </p>
      <Bars
        label="Shared-birthday probability for 1 to 60 people"
        max={1}
        series={[{ name: 'p', values: curve, className: 'bar-primary' }]}
      />
    </>
  );
}

function BayesLab() {
  const [prevalence, setPrevalence] = useState(0.01);
  const [sensitivity, setSensitivity] = useState(0.95);
  const [falsePositive, setFalsePositive] = useState(0.05);
  const [posterior] = bayesPosterior(
    [prevalence, 1 - prevalence],
    [sensitivity, falsePositive],
  );
  return (
    <>
      <NumberField
        label="Prior P(D)"
        name="prior"
        value={prevalence}
        min={0.001}
        max={0.5}
        step={0.001}
        onChange={setPrevalence}
      />
      <NumberField
        label="P(+ | D)"
        name="sensitivity"
        value={sensitivity}
        min={0.5}
        max={1}
        step={0.01}
        onChange={setSensitivity}
      />
      <NumberField
        label="P(+ | not D)"
        name="false-positive"
        value={falsePositive}
        min={0}
        max={0.5}
        step={0.01}
        onChange={setFalsePositive}
      />
      <p className="result-line" data-testid="lab-result">
        P(D | +) = {fmt(posterior)}
      </p>
    </>
  );
}

function BinomialPoissonLab() {
  const [n, setN] = useState(50);
  const [p, setP] = useState(0.06);
  const lambda = n * p;
  const ks = Array.from({ length: 16 }, (_, k) => k);
  const bin = ks.map((k) => binomialPmf(n, p, k));
  const poi = ks.map((k) => poissonPmf(lambda, k));
  const gap = Math.max(...ks.map((k) => Math.abs(bin[k] - poi[k])));
  return (
    <>
      <NumberField
        label="Trials n"
        name="trials"
        value={n}
        min={5}
        max={500}
        step={5}
        onChange={setN}
      />
      <NumberField
        label="Success probability p"
        name="p"
        value={p}
        min={0.005}
        max={0.5}
        step={0.005}
        onChange={setP}
      />
      <p className="result-line" data-testid="lab-result">
        λ = np = {fmt(lambda, 2)}; largest gap over k ≤ 15 = {fmt(gap)}
      </p>
      <Bars
        label="Binomial (dark) against Poisson (light) probabilities for k = 0 to 15"
        max={Math.max(...bin, ...poi)}
        series={[
          { name: 'binomial', values: bin, className: 'bar-primary' },
          { name: 'poisson', values: poi, className: 'bar-secondary' },
        ]}
      />
    </>
  );
}

function NormalApproximationLab() {
  const [n, setN] = useState(40);
  const [p, setP] = useState(0.5);
  const { mean, variance } = binomialSummary(n, p);
  const k = Math.round(mean);
  const exact = binomialPmf(n, p, k);
  const approx = normalApproxBinomialPoint(n, p, k);
  const ks = Array.from({ length: n + 1 }, (_, i) => i);
  return (
    <>
      <NumberField
        label="Trials n"
        name="trials"
        value={n}
        min={5}
        max={200}
        step={1}
        onChange={setN}
      />
      <NumberField
        label="Success probability p"
        name="p"
        value={p}
        min={0.05}
        max={0.95}
        step={0.05}
        onChange={setP}
      />
      <p className="result-line" data-testid="lab-result">
        P(X = {k}): exact {fmt(exact)}, normal with continuity correction{' '}
        {fmt(approx)}
      </p>
      <Bars
        label="Binomial probabilities (dark) and the normal density at each integer (light)"
        max={Math.max(exact, normalPdf(mean, mean, Math.sqrt(variance)))}
        series={[
          {
            name: 'binomial',
            values: ks.map((i) => binomialPmf(n, p, i)),
            className: 'bar-primary',
          },
          {
            name: 'normal',
            values: ks.map((i) => normalPdf(i, mean, Math.sqrt(variance))),
            className: 'bar-secondary',
          },
        ]}
      />
    </>
  );
}

function LawOfLargeNumbersLab() {
  const [tosses, setTosses] = useState(1000);
  const [seed, setSeed] = useState(1);
  const path = useMemo(() => runningProportion(tosses, seed), [tosses, seed]);
  const sampled = Array.from(
    { length: 50 },
    (_, i) => path[Math.floor(((i + 1) * tosses) / 50) - 1],
  );
  return (
    <>
      <NumberField
        label="Tosses"
        name="tosses"
        value={tosses}
        min={50}
        max={20000}
        step={50}
        onChange={setTosses}
      />
      <button type="button" onClick={() => setSeed(seed + 1)}>
        New run
      </button>
      <p className="result-line" data-testid="lab-result">
        Proportion of heads after {tosses} tosses = {fmt(path[path.length - 1])}
      </p>
      <Bars
        label="Running proportion of heads"
        max={1}
        series={[
          { name: 'proportion', values: sampled, className: 'bar-primary' },
        ]}
      />
    </>
  );
}

function CentralLimitLab() {
  const [n, setN] = useState(1);
  const values = useMemo(() => standardizedUniformSums(n, 4000, 17), [n]);
  const bins = histogram(values, -4, 4, 32);
  const target = bins.map((b) => normalPdf((b.from + b.to) / 2));
  const gap = Math.max(...bins.map((b, i) => Math.abs(b.density - target[i])));
  return (
    <>
      <NumberField
        label="Uniform draws per sum n"
        name="n"
        value={n}
        min={1}
        max={30}
        step={1}
        onChange={setN}
      />
      <p className="result-line" data-testid="lab-result">
        Largest gap between histogram and standard normal density ={' '}
        {fmt(gap, 3)}
      </p>
      <Bars
        label="Histogram of standardised sums (dark) against the standard normal density (light)"
        max={0.6}
        series={[
          {
            name: 'histogram',
            values: bins.map((b) => b.density),
            className: 'bar-primary',
          },
          { name: 'normal', values: target, className: 'bar-secondary' },
        ]}
      />
    </>
  );
}

const registry: Record<
  LabId,
  { title: string; Component: () => React.JSX.Element }
> = {
  birthday: { title: 'Shared birthdays', Component: BirthdayLab },
  bayes: { title: 'Updating with Bayes’ rule', Component: BayesLab },
  'binomial-poisson': {
    title: 'Binomial meets Poisson',
    Component: BinomialPoissonLab,
  },
  'normal-approximation': {
    title: 'Normal approximation',
    Component: NormalApproximationLab,
  },
  'law-of-large-numbers': {
    title: 'Averages settle',
    Component: LawOfLargeNumbersLab,
  },
  'central-limit': { title: 'Sums become normal', Component: CentralLimitLab },
};
export const labIds = Object.keys(registry) as LabId[];

export default function Labs({ id }: { id: LabId }) {
  const { title, Component } = registry[id];
  return (
    <section id="lab" className="content-section lab" data-lab={id}>
      <span className="callout-label">EXPERIMENT</span>
      <h2>{title}</h2>
      <Component />
    </section>
  );
}
