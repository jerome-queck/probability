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
      // Display formulas keep display mode (MathML display="block"); CSS lets a long chain
      // of equalities wrap after a relation on a phone instead of being cut off.
      html = katex.renderToString(
        `${latex}${trailing ? `\\text{${trailing}}` : ''}`,
        {
          displayMode,
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
        className={
          displayMode
            ? 'math-block'
            : // Short formulas never break; long ones may break after a relation, as TeX does.
              // Mid-length ones stay whole except on phones, where they could overflow.
              latex.length <= 24
              ? 'math-inline math-nowrap'
              : latex.length <= 48
                ? 'math-inline math-nowrap-wide'
                : 'math-inline'
        }
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
