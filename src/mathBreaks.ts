// KaTeX may break an inline formula after any top-level relation (=, \le, …) or binary
// operator (+, −, \cdot, …). Two cases read badly: a tiny last piece such as "= 66." alone on
// the next line, and a short bracket such as (n−k) torn in half. Braces make a group KaTeX
// will not break inside, so both are wrapped in braces.
const breakAfter =
  /^(=|<|>|\+|-|\\(?:le|leq|ge|geq|ne|neq|approx|sim|equiv|cdot|times|pm|mp|cup|cap)(?![a-zA-Z]))/;

function groupShortBrackets(latex: string): string {
  return latex.replace(
    /(?<!\\left|\\big|\\Big)\(([^()]{1,12})\)/g,
    (m, inner) =>
      inner.includes('{') || inner.includes('}') ? m : `({${inner}})`,
  );
}

const visible = (s: string) =>
  s.replace(/\\[a-zA-Z]+/g, 'x').replace(/[\s{}]/g, '').length;

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
  if (last === undefined || visible(latex.slice(last)) > 6) return latex;
  const from = cuts.length > 1 ? cuts[cuts.length - 2] : 0;
  return `${latex.slice(0, from)}{${latex.slice(from)}}`;
}
