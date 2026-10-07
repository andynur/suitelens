import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Minimal Markdown renderer for SuiteLens-generated documents (headings, paragraphs, lists,
 * tables, inline code and bold). Output is React text nodes only, never HTML, so metadata
 * values can not inject markup. Table columns that are empty in every row are hidden.
 */
export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string; id: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'code'; text: string };

const EMPTY_CELL = /^(?:|—|-|–)$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function slug(text: string, used: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.split('\n');
  const blocks: MarkdownBlock[] = [];
  const used = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) body.push(lines[i++]!);
      i++;
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const text = heading[2]!.trim();
      blocks.push({ kind: 'heading', level: heading[1]!.length, text, id: slug(text, used) });
      i++;
      continue;
    }
    if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(splitRow(lines[i++]!));
      const keep = header.map(
        (_, column) => rows.length === 0 || rows.some((row) => !EMPTY_CELL.test(row[column] ?? '')),
      );
      blocks.push({
        kind: 'table',
        header: header.filter((_, column) => keep[column]),
        rows: rows.map((row) => row.filter((_, column) => keep[column])),
      });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!))
        items.push(lines[i++]!.replace(/^\s*[-*]\s+/, ''));
      blocks.push({ kind: 'list', items });
      continue;
    }
    const text: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,6}\s|```|\s*[-*]\s+|\s*\|)/.test(lines[i]!)
    )
      text.push(lines[i++]!.trim());
    if (text.length) blocks.push({ kind: 'paragraph', text: text.join(' ') });
    else i++;
  }
  return blocks;
}

/** `code` and **bold** spans as React nodes. */
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1)
      return (
        <code key={index} className="rounded-xs bg-muted px-0.5 font-mono wrap-anywhere">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith('**') && part.endsWith('**') && part.length > 3)
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

const HEADING = ['text-base', 'text-sm', 'text-sm', 'text-xs', 'text-xs', 'text-xs'];

export function MarkdownView({
  source,
  label,
  toc = false,
  className,
}: {
  source: string;
  label: string;
  toc?: boolean;
  className?: string;
}) {
  const blocks = parseMarkdown(source);
  const sections = blocks.filter(
    (b): b is Extract<MarkdownBlock, { kind: 'heading' }> => b.kind === 'heading' && b.level === 2,
  );
  return (
    <article
      aria-label={label}
      tabIndex={0}
      className={cn('flex flex-col gap-2 text-xs text-fg', className)}
    >
      {toc && sections.length > 2 && (
        <nav aria-label={`${label}: contents`} className="rounded-lg bg-muted p-2">
          <ol className="flex flex-wrap gap-x-3 gap-y-0.5">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-accent hover:underline">
                  {section.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const Tag = `h${Math.min(6, block.level + 1)}` as 'h2';
          return (
            <Tag
              key={index}
              id={block.id}
              className={cn('mt-1 font-semibold text-fg', HEADING[block.level - 1])}
            >
              {inline(block.text)}
            </Tag>
          );
        }
        if (block.kind === 'paragraph')
          return (
            <p key={index} className="text-fg-muted">
              {inline(block.text)}
            </p>
          );
        if (block.kind === 'list')
          return (
            <ul key={index} className="list-disc pl-4 text-fg-muted">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </ul>
          );
        if (block.kind === 'code')
          return (
            <pre
              key={index}
              className="rounded-lg bg-muted p-2 font-mono whitespace-pre-wrap wrap-anywhere"
            >
              {block.text}
            </pre>
          );
        return (
          <div key={index} className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full border-collapse">
              <thead className="bg-muted text-left text-fg-muted">
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th key={cellIndex} scope="col" className="px-2 py-1 font-semibold">
                      {inline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-line align-top">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-2 py-1 wrap-anywhere">
                        {inline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </article>
  );
}
