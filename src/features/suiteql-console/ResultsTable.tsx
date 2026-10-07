import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../shared/i18n';
import { Button, IconButton } from '../../shared/ui/Button';
import { copyWithToast } from '../../shared/ui/clipboard';
import { CheckIcon, CopyIcon } from '../../shared/ui/icons';
import {
  resultCellText,
  resultColumns,
  resultRowText,
  sortResults,
  type ResultRow,
  type ResultSort,
} from './results';

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 32;
const OVERSCAN = 5;
const MIN_WIDTH = 96;
const MAX_WIDTH = 640;
/** Approximate width of one character in the 12px monospace cell font. */
const CHAR_WIDTH = 7.25;
/** Cell padding plus the hover copy button. */
const CELL_CHROME = 48;
/** Rows sampled for the initial column width. */
const SAMPLE_ROWS = 200;

/**
 * Initial width per column from its header and the longest sampled value, so short columns do
 * not waste space and long IDs are not cut while the table has room. Users can still resize.
 */
export function autoColumnWidths(rows: ResultRow[], columns: string[]): Record<string, number> {
  const sample = rows.slice(0, SAMPLE_ROWS);
  return Object.fromEntries(
    columns.map((column) => {
      const longest = sample.reduce(
        (max, row) => Math.max(max, resultCellText(row[column]).length),
        column.length,
      );
      const width = Math.round(longest * CHAR_WIDTH + CELL_CHROME);
      return [column, Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))];
    }),
  );
}

export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  const columns = useMemo(() => resultColumns(rows), [rows]);
  const [sort, setSort] = useState<ResultSort>();
  const ordered = useMemo(() => sortResults(rows, sort), [rows, sort]);
  const autoWidths = useMemo(() => autoColumnWidths(rows, columns), [rows, columns]);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(320);
  const [copied, setCopied] = useState<string>();
  const viewport = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resize = useRef<{ column: string; x: number; width: number }>(undefined);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.clientHeight));
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer.current);
    };
  }, []);
  function width(column: string) {
    return Object.hasOwn(widths, column) ? widths[column]! : (autoWidths[column] ?? 192);
  }
  function setWidth(column: string, value: number) {
    setWidths((previous) => ({
      ...previous,
      [column]: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value)),
    }));
  }
  async function copy(text: string, id: string) {
    if (await copyWithToast(text)) {
      clearTimeout(timer.current);
      setCopied(id);
      timer.current = setTimeout(() => setCopied(undefined), 1500);
    }
  }
  const start = Math.min(
    Math.max(0, ordered.length - 1),
    Math.max(0, Math.floor((scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN),
  );
  const end = Math.min(ordered.length, start + Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2);
  const totalWidth = columns.reduce((sum, column) => sum + width(column), 48);
  return (
    <div
      ref={viewport}
      role="region"
      aria-label={t('console.results')}
      tabIndex={0}
      className="h-80 overflow-auto rounded-lg border border-line bg-surface"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <table
        aria-label={t('console.results')}
        aria-rowcount={rows.length + 1}
        className="table-fixed border-collapse text-xs"
        style={{ width: totalWidth }}
      >
        <colgroup>
          {columns.map((column) => (
            <col key={column} style={{ width: width(column) }} />
          ))}
          <col style={{ width: 48 }} />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-surface">
          <tr style={{ height: HEADER_HEIGHT }}>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                aria-sort={sort?.column === column ? sort.direction : 'none'}
                className="relative border-b border-line px-2 text-left font-semibold text-fg-muted"
              >
                <Button
                  variant="ghost"
                  spacing="compact"
                  title={column}
                  onClick={() => {
                    setSort({
                      column,
                      direction:
                        sort?.column === column && sort.direction === 'ascending'
                          ? 'descending'
                          : 'ascending',
                    });
                    if (viewport.current) viewport.current.scrollTop = 0;
                    setScrollTop(0);
                  }}
                >
                  <span className="truncate" style={{ maxWidth: width(column) - 48 }}>
                    {column}
                  </span>
                  {sort?.column === column && (
                    <span aria-hidden>{sort.direction === 'ascending' ? '↑' : '↓'}</span>
                  )}
                </Button>
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t('console.resizeColumn', { column })}
                  tabIndex={0}
                  aria-valuemin={MIN_WIDTH}
                  aria-valuemax={MAX_WIDTH}
                  aria-valuenow={width(column)}
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none border-r border-line-input"
                  onKeyDown={(event) => {
                    if (
                      event.key === 'ArrowLeft' ||
                      event.key === 'ArrowRight' ||
                      event.key === 'Home' ||
                      event.key === 'End'
                    ) {
                      event.preventDefault();
                      setWidth(
                        column,
                        event.key === 'Home'
                          ? MIN_WIDTH
                          : event.key === 'End'
                            ? MAX_WIDTH
                            : width(column) + (event.key === 'ArrowLeft' ? -16 : 16),
                      );
                    }
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.focus();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    resize.current = { column, x: event.clientX, width: width(column) };
                  }}
                  onPointerMove={(event) => {
                    if (resize.current?.column === column)
                      setWidth(column, resize.current.width + event.clientX - resize.current.x);
                  }}
                  onPointerUp={(event) => {
                    resize.current = undefined;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onLostPointerCapture={() => {
                    resize.current = undefined;
                  }}
                />
              </th>
            ))}
            <th scope="col" className="border-b border-line">
              <span className="sr-only">{t('console.rowActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {start > 0 && (
            <tr aria-hidden>
              <td colSpan={columns.length + 1} style={{ height: start * ROW_HEIGHT, padding: 0 }} />
            </tr>
          )}
          {ordered.slice(start, end).map((row, offset) => {
            const index = start + offset;
            return (
              <tr
                key={index}
                aria-rowindex={index + 2}
                className="group border-b border-line hover:bg-muted"
                style={{ height: ROW_HEIGHT }}
              >
                {columns.map((column) => {
                  const value = row[column];
                  const text = resultCellText(value);
                  const id = `${index}:${column}`;
                  return (
                    <td key={column} className="px-2 py-0">
                      <div className="flex items-center gap-1">
                        <span
                          title={text}
                          className={`min-w-0 flex-1 truncate font-mono ${value == null ? 'text-fg-subtlest italic' : 'text-fg'}`}
                        >
                          {value == null ? t('console.null') : text}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                          <IconButton
                            label={t('console.copyCell', { column, row: index + 1 })}
                            onClick={() => void copy(text, id)}
                            icon={
                              copied === id ? <CheckIcon className="text-success" /> : <CopyIcon />
                            }
                          />
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-0">
                  <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton
                      label={t('console.copyRow', { row: index + 1 })}
                      onClick={() => void copy(resultRowText(row, columns), `row:${index}`)}
                      icon={
                        copied === `row:${index}` ? (
                          <CheckIcon className="text-success" />
                        ) : (
                          <CopyIcon />
                        )
                      }
                    />
                  </span>
                </td>
              </tr>
            );
          })}
          {end < ordered.length && (
            <tr aria-hidden>
              <td
                colSpan={columns.length + 1}
                style={{ height: (ordered.length - end) * ROW_HEIGHT, padding: 0 }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
