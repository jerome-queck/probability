import katex from 'katex';
import { Fragment } from 'react';
import 'katex/dist/katex.min.css';

// Punctuation right after a formula is kept with it, so a period never wraps alone.
const pattern = /\\\[([\s\S]*?)\\\]([.,;:]?)|\\\(([\s\S]*?)\\\)([.,;:]?)/g;
export function MathText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let from = 0;
  pattern.lastIndex = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > from)
      parts.push(
        <Fragment key={`t${from}`}>{text.slice(from, match.index)}</Fragment>,
      );
    const displayMode = match[1] !== undefined;
    const latex = match[1] ?? match[3];
    const trailing = (displayMode ? match[2] : match[4]) ?? '';
    let html: string;
    try {
      // Display formulas are typeset in display style but as breakable inline math, so a
      // long chain of equalities wraps after a relation on a phone instead of being cut
      // off; on a wide screen it still sits on one centred line.
      html = katex.renderToString(
        `${displayMode ? '\\displaystyle ' : ''}${latex}${trailing ? `\\text{${trailing}}` : ''}`,
        {
          displayMode: false,
          throwOnError: true,
          trust: false,
          output: 'htmlAndMathml',
        },
      );
    } catch {
      html = `<span class="math-error">Invalid mathematics: ${escapeHtml(latex)}</span>`;
    }
    parts.push(
      <span
        key={`m${match.index}`}
        className={displayMode ? 'math-block' : 'math-inline'}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX runs with trust disabled; error text is escaped.
        dangerouslySetInnerHTML={{ __html: html }}
      />,
    );
    from = pattern.lastIndex;
  }
  if (from < text.length)
    parts.push(<Fragment key={`t${from}`}>{text.slice(from)}</Fragment>);
  return <>{parts}</>;
}
function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (c) => entities[c] ?? c);
}
