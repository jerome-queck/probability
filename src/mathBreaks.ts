const relation =
  /^(=|<|>|\\(?:le|leq|ge|geq|ne|neq|approx|sim|equiv)(?![a-zA-Z]))/;

/**
 * KaTeX may break a line after any top-level relation. When the last piece after a
 * relation is tiny (say "= 66"), braces join it to the piece before, so it cannot wrap
 * alone onto a new line.
 */
export function keepShortTail(latex: string): string {
  const cuts: { at: number; end: number }[] = [];
  let depth = 0;
  for (let i = 0; i < latex.length; i++) {
    const c = latex[i];
    if (c === '\\' && (latex[i + 1] === '{' || latex[i + 1] === '}')) {
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (depth === 0) {
      const m = relation.exec(latex.slice(i));
      if (m) {
        cuts.push({ at: i, end: i + m[0].length });
        i += m[0].length - 1;
      }
    }
  }
  const last = cuts.at(-1);
  if (
    !last ||
    latex.slice(last.end).replace(/\\[a-zA-Z]+|[\s{}]/g, 'x').length > 8
  )
    return latex;
  const from = cuts.length > 1 ? cuts[cuts.length - 2].end : 0;
  return `${latex.slice(0, from)}{${latex.slice(from)}}`;
}
