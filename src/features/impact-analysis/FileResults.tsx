import { useState } from 'react';
import { t } from '../../shared/i18n';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { cn } from '../../shared/ui/cn';
import { fieldClass } from '../../shared/ui/field';
import { ChevronRightIcon } from '../../shared/ui/icons';
import { ToggleChip } from '../../shared/ui/ToggleChip';
import type { ImpactScanResult } from './scan';

export const FILE_FILTERS = ['all', 'hits', 'clean', 'not-checked'] as const;
export type FileFilter = (typeof FILE_FILTERS)[number];

/** Cards rendered per source before "Show more"; a full scan returns hundreds of files. */
export const FILE_PAGE_SIZE = 50;
/** Below this, a name filter adds noise rather than help. */
const SEARCH_THRESHOLD = 10;

type FileStatus = Exclude<FileFilter, 'all'>;

export function fileStatus(file: ImpactScanResult): FileStatus {
  if (file.status === 'not-checked') return 'not-checked';
  return file.hits.length ? 'hits' : 'clean';
}

const RANK: Record<FileStatus, number> = { hits: 0, clean: 1, 'not-checked': 2 };

/**
 * Files with references first (most references first), then checked files without references,
 * then files that could not be checked (DESIGN.md: items that cannot run go last). The sort is
 * stable, so ties keep plan order and cards do not jump while a scan runs.
 */
export function sortFileResults(results: readonly ImpactScanResult[]): ImpactScanResult[] {
  return [...results].sort(
    (a, b) =>
      RANK[fileStatus(a)] - RANK[fileStatus(b)] ||
      (fileStatus(a) === 'hits' ? b.hits.length - a.hits.length : 0),
  );
}

export function countFileResults(results: readonly ImpactScanResult[]): Record<FileFilter, number> {
  const counts: Record<FileFilter, number> = {
    all: results.length,
    hits: 0,
    clean: 0,
    'not-checked': 0,
  };
  for (const result of results) counts[fileStatus(result)]++;
  return counts;
}

/** Filter chips plus an optional name search shared by every file source section. */
export function FileResultFilters({
  counts,
  filter,
  onFilter,
  query,
  onQuery,
}: {
  counts: Record<FileFilter, number>;
  filter: FileFilter;
  onFilter: (filter: FileFilter) => void;
  query: string;
  onQuery: (query: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t('impact.filterFiles')}
        className="flex flex-wrap items-center gap-1"
      >
        {FILE_FILTERS.map((value) => (
          <ToggleChip
            key={value}
            pressed={filter === value}
            onPressedChange={() => onFilter(value)}
          >
            {t(`impact.filter.${value}`)}
            <span className="font-normal">{counts[value]}</span>
          </ToggleChip>
        ))}
      </div>
      {counts.all >= SEARCH_THRESHOLD && (
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t('impact.searchFiles')}
          aria-label={t('impact.searchFiles')}
          className={cn(fieldClass, 'min-w-0')}
        />
      )}
    </div>
  );
}

/** One source section: sorted, filtered and paged file cards. */
export function FileResultSection({
  label,
  planned,
  results,
  filter,
  query,
  names,
}: {
  label: string;
  planned: number;
  results: readonly ImpactScanResult[];
  filter: FileFilter;
  query: string;
  names: ReadonlyMap<string, string>;
  /** Kept for callers; per-file timestamps moved to the results header (ADR 0051). */
  now?: number;
}) {
  const [limit, setLimit] = useState(FILE_PAGE_SIZE);
  const needle = query.trim().toLowerCase();
  const visible = sortFileResults(results).filter(
    (file) =>
      (filter === 'all' || fileStatus(file) === filter) &&
      (!needle ||
        file.fileId.includes(needle) ||
        (names.get(file.fileId) ?? '').toLowerCase().includes(needle)),
  );
  return (
    <section className="flex flex-col gap-2" aria-label={label}>
      <h3 className="text-fg-muted">
        {label} ({results.length}/{planned})
      </h3>
      {results.length > 0 && visible.length === 0 && (
        <p className="py-3 text-center text-xs text-fg-muted">{t('impact.noFilterMatches')}</p>
      )}
      <ol className="flex flex-col gap-1">
        {visible.slice(0, limit).map((file) => (
          <FileCard key={file.fileId} file={file} name={names.get(file.fileId)} />
        ))}
      </ol>
      {visible.length > limit && (
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => setLimit((current) => current + FILE_PAGE_SIZE)}
        >
          {t('impact.showMore', { count: Math.min(FILE_PAGE_SIZE, visible.length - limit) })}
        </Button>
      )}
    </section>
  );
}

function reasonText(file: ImpactScanResult) {
  if (file.failure) return t(`impact.failure.${file.failure}`);
  if (!file.reason) return '';
  if (
    file.reason === 'invalid-target' ||
    file.reason === 'content-too-large' ||
    file.reason === 'match-limit'
  )
    return t('impact.limit');
  return t(`error.${file.reason}`);
}

/**
 * Collapsible card (DESIGN.md §9). Files with references open by default; the rest show only
 * name, status and ID until clicked. Not-checked files carry no dependency panel, because their
 * source was never read. Scan-wide status (index use, links, excerpt notes, time) is shown once
 * in the results header instead of on every card.
 */
function FileCard({ file, name }: { file: ImpactScanResult; name: string | undefined }) {
  const status = fileStatus(file);
  return (
    <li
      className={cn(
        'rounded-lg border bg-surface text-xs',
        status === 'not-checked' ? 'border-dashed border-line-input' : 'border-line',
      )}
    >
      <details open={status === 'hits'} className="group/card">
        <summary className="flex cursor-pointer list-none items-start gap-1.5 rounded-lg px-2 py-1.5 hover:bg-muted">
          <ChevronRightIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform group-open/card:rotate-90 motion-reduce:transition-none" />
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-1">
              <span
                className={cn(
                  'min-w-0 flex-1 font-semibold wrap-anywhere',
                  status === 'not-checked' ? 'text-fg-muted' : 'text-fg',
                )}
              >
                {name || t('impact.file', { id: file.fileId })}
              </span>
              {status === 'hits' && (
                <Badge tone="info">{t('impact.hitCount', { count: file.hits.length })}</Badge>
              )}
              {status === 'not-checked' && <Badge tone="warning">{t('impact.notChecked')}</Badge>}
            </span>
            {name && (
              <span className="block text-fg-subtlest">
                {t('impact.file', { id: file.fileId })}
              </span>
            )}
            {status === 'not-checked' && (
              <span className="block text-fg-muted">{reasonText(file)}</span>
            )}
          </span>
        </summary>
        <div className="flex flex-col gap-1 px-2 pb-2 pl-7">
          {file.sourceUrl && (
            <a
              className="self-start text-accent hover:underline"
              href={file.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('impact.openSource')} ↗
            </a>
          )}
          {status === 'clean' && <p className="text-fg-muted">{t('impact.noHits')}</p>}
          {!!file.hits.length && (
            <ul className="flex flex-col">
              {file.hits.map((hit) => {
                const line = hit.excerpt?.lines[hit.line - hit.excerpt.startLine];
                return (
                  <li
                    key={`${hit.offset}:${hit.kind}`}
                    className="border-t border-line py-1 first:border-t-0"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="shrink-0 font-mono text-fg-subtlest"
                        title={t('impact.hit', { line: hit.line, column: hit.column })}
                      >
                        <span className="sr-only">
                          {t('impact.hit', { line: hit.line, column: hit.column })}
                        </span>
                        <span aria-hidden>
                          {t('impact.hitShort', { line: hit.line, column: hit.column })}
                        </span>
                      </span>
                      <code className="min-w-0 flex-1 truncate font-mono text-fg" title={line}>
                        {line?.trim() ?? ''}
                      </code>
                      <span className="shrink-0 text-fg-subtlest">{t(`impact.${hit.kind}`)}</span>
                    </div>
                    {hit.excerpt && (
                      <details className="mt-0.5">
                        <summary className="cursor-pointer text-fg-subtlest hover:text-fg">
                          {t('impact.excerpt', { line: hit.line })}
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap wrap-anywhere rounded-sm bg-muted p-1 font-mono text-xs">
                          {hit.excerpt.lines.map((text, index) => (
                            <span
                              key={index}
                              className={`block ${hit.excerpt!.startLine + index === hit.line ? 'bg-selected text-fg' : 'text-fg-muted'}`}
                            >
                              {hit.excerpt!.startLine + index}: {text}
                            </span>
                          ))}
                        </pre>
                        {hit.excerpt.truncated && (
                          <p className="text-fg-subtlest">{t('impact.excerptTruncated')}</p>
                        )}
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {file.source === 'script' && status !== 'not-checked' && (
            <details className="rounded-lg border border-line bg-surface">
              <summary className="px-2 py-1.5 hover:bg-muted">{t('impact.dependencies')}</summary>
              <div className="px-2 pb-1">
                <p className="text-fg-subtlest">{t('impact.dependenciesCoverage')}</p>
                {!file.dependencies && <p>{t('impact.dependenciesUnavailable')}</p>}
                {file.dependencies?.reason && (
                  <p>{t(`impact.dependencies.${file.dependencies.reason}`)}</p>
                )}
                <ul className="flex flex-col gap-2">
                  {file.dependencies?.declarations.map((declaration, index) => (
                    <li key={index}>
                      {t('impact.defineLine', { line: declaration.line })}
                      {declaration.modules.length === 0 && <p>{t('impact.noStaticImports')}</p>}
                      <ul className="ml-3 list-disc">
                        {declaration.modules.map((module, moduleIndex) => (
                          <li key={moduleIndex} className="wrap-anywhere font-mono">
                            <span>{module.id}</span>
                            <span className="block font-sans text-fg-subtlest">
                              {t('impact.moduleLocation', {
                                line: module.line,
                                column: module.column,
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </div>
      </details>
    </li>
  );
}
