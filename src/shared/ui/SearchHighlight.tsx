import { Fragment } from 'react';

/** Literal, case-insensitive matches; React keeps payload text escaped. */
export function SearchHighlight({
  text,
  query,
  breakIds = false,
}: {
  text: string;
  query: string;
  breakIds?: boolean;
}) {
  const renderText = (value: string) =>
    breakIds
      ? value.split('_').map((part, index, parts) => (
          <Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <>
                _<wbr />
              </>
            )}
          </Fragment>
        ))
      : value;
  const term = query.trim();
  if (!term) return <span>{renderText(text)}</span>;
  const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const parts = [];
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(
      <Fragment key={`text:${start}`}>{renderText(text.slice(start, match.index))}</Fragment>,
    );
    parts.push(
      <mark key={`match:${match.index}`} className="rounded-xs bg-warning-bg text-fg">
        {renderText(match[0])}
      </mark>,
    );
    start = match.index + match[0].length;
  }
  parts.push(<Fragment key={`tail:${start}`}>{renderText(text.slice(start))}</Fragment>);
  return <span>{parts}</span>;
}
