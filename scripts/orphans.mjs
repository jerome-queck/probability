// Which wrapped inline formulas read badly on a narrow screen. Pure, so it can be tested on
// widths measured from real pages; scripts/control-probability.mjs measures each
// .math-inline .katex-html (one width per line it spans) and calls this.
export const MIN_LAST_PX = 40; // a last piece narrower than this is a scrap ("= 66.")
export const MIN_SPLIT_TOTAL_PX = 120; // a formula narrower than this fits on any line

export function orphanProblems(formulas) {
  const problems = [];
  for (const { text, widths } of formulas) {
    if (widths.length < 2) continue;
    const total = widths.reduce((a, b) => a + b, 0);
    if (widths.at(-1) < MIN_LAST_PX)
      problems.push(
        `orphaned formula fragment: “${text.slice(-20)}” wraps alone onto a new line`,
      );
    else if (total < MIN_SPLIT_TOTAL_PX)
      problems.push(
        `short formula split across lines: “${text.slice(0, 30)}” (${widths.join(' + ')}px) would fit on one line; keep it whole (see isShortFormula in src/mathBreaks.ts) or display it`,
      );
  }
  return problems;
}
