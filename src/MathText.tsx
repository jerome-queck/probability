import katex from 'katex';
import { Fragment } from 'react';
import 'katex/dist/katex.min.css';

const pattern = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
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
    const latex = match[1] ?? match[2];
    let html: string;
    try {
      html = katex.renderToString(latex, {
        displayMode,
        throwOnError: true,
        trust: false,
        output: 'htmlAndMathml',
      });
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
