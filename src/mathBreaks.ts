// KaTeX may break an inline formula after any top-level relation (=, \le, …) or binary
// operator (+, −, \cdot, …). Two cases read badly: a tiny last piece such as "= 66." alone on
// the next line, and a short bracket such as (n−k) torn in half. Braces make a group KaTeX
// will not break inside, so both are wrapped in braces.
const breakAfter =
  /^(=|<|>|\+|-|\\(?:le|leq|ge|geq|ne|neq|approx|sim|equiv|cdot|times|pm|mp|cup|cap)(?![a-zA-Z]))/;

// Wrap the inside of every bracket pair with at most 20 visible characters in braces, so the
// bracket cannot be torn across lines. \left…\right pairs already never break.
const visible = (s: string) =>
  s.replace(/\\[a-zA-Z]+/g, 'x').replace(/[\s{}]/g, '').length;

function groupShortBrackets(latex: string): string {
  const open: number[] = [];
  const pairs: [number, number][] = [];
  for (let i = 0; i < latex.length; i++) {
    const c = latex[i];
    if (c === '\\' && /[{}()]/.test(latex[i + 1] ?? '')) {
      i++;
      continue;
    }
    if (c === '(') open.push(i);
    else if (c === ')' && open.length) {
      const from = open.pop() as number;
      if (
        visible(latex.slice(from + 1, i)) <= 20 &&
        !/\\left\s*$/.test(latex.slice(0, from))
      )
        pairs.push([from, i]);
    }
  }
  // Only outermost short pairs; inner ones are already inside the group.
  const outer = pairs.filter(
    ([a, b]) => !pairs.some(([c, d]) => c < a && b < d),
  );
  let out = latex;
  for (const [a, b] of outer.sort((x, y) => y[0] - x[0])) {
    const inner = out.slice(a + 1, b);
    let depth = 0;
    let balanced = true;
    for (const ch of inner.replace(/\\[{}]/g, '')) {
      if (ch === '{') depth++;
      if (ch === '}' && --depth < 0) balanced = false;
    }
    if (!balanced || depth !== 0) continue;
    // Keep a closing size command such as \big outside the group, next to its bracket.
    const size = /\\[bB]igg?[lr]?\s*$/.exec(inner)?.[0] ?? '';
    const body = inner.slice(0, inner.length - size.length);
    out = `${out.slice(0, a + 1)}{${body}}${size}${out.slice(b)}`;
  }
  return out;
}

export function keepShortTail(input: string): string {
  const latex = groupShortBrackets(input);
  const cuts: number[] = [];
  let depth = 0;
  for (let i = 0; i < latex.length; i++) {
    const c = latex[i];
    if (c === '\\' && '{}()'.includes(latex[i + 1] ?? '')) {
      i++;
      continue;
    }
    // \left…\right never breaks inside, so it counts as one level of nesting.
    const lr = /^\\(left|right)(?![a-zA-Z])\s*(\\[{}|]|\\[a-zA-Z]+|.)/.exec(
      latex.slice(i),
    );
    if (lr) {
      depth += lr[1] === 'left' ? 1 : -1;
      i += lr[0].length - 1;
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (depth === 0) {
      const m = breakAfter.exec(latex.slice(i));
      if (m) {
        i += m[0].length - 1;
        cuts.push(i + 1);
      }
    }
  }
  const last = cuts.at(-1);
  if (last === undefined || visible(latex.slice(last)) > 10) return latex;
  const from = cuts.length > 1 ? cuts[cuts.length - 2] : 0;
  return `${latex.slice(0, from)}{${latex.slice(from)}}`;
}
