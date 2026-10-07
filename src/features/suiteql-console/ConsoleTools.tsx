import { SearchHighlight } from '../../shared/ui/SearchHighlight';
import { useEffect, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { ConsoleSqlSchema, throwIfCancelled } from '../../netsuite/queries/console';
import { CONSOLE_EXAMPLES } from '../../netsuite/queries/consoleExamples';
import { METADATA_SOURCES, mapMetadata, mergeMetadata } from '../../netsuite/queries/metadata';
import {
  getConsoleLibraryStorage,
  importSnippets,
  MetadataTableSchema,
  type ConsoleLibrary,
  type Snippet,
} from '../../shared/storage/consoleLibrary';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { fieldClass } from '../../shared/ui/field';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import { downloadLocal } from './export';
import { z } from 'zod';

export function ConsoleTools({
  accountId,
  adapter,
  library,
  onLibrary,
  sql,
  variables,
  apply,
  drawer = false,
}: {
  /** Inside the Console drawer the section has no own disclosure. */
  drawer?: boolean;
  accountId: string;
  adapter: NetSuiteAdapter;
  library: ConsoleLibrary;
  onLibrary: (library: ConsoleLibrary) => void;
  sql: string;
  variables: Snippet['variables'];
  apply: (sql: string, variables?: Snippet['variables']) => void;
}) {
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<SuiteLensErrorShape>();
  const [indexing, setIndexing] = useState(false);
  const controller = useRef<AbortController>(undefined);
  const mounted = useRef(true);
  const store = getConsoleLibraryStorage();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const update = async (change: (previous: ConsoleLibrary) => ConsoleLibrary) => {
    try {
      const next = await store.update(accountId, change);
      if (mounted.current) {
        onLibrary(next);
        setError(undefined);
      }
    } catch (err) {
      if (mounted.current) setError(toSuiteLensError(err).toShape());
    }
  };
  const index = async () => {
    const run = new AbortController();
    controller.current = run;
    setIndexing(true);
    setError(undefined);
    try {
      let state = await store.load(accountId);
      for (let next = state.metadata?.next ?? 0; next < METADATA_SOURCES.length; next++) {
        throwIfCancelled(run.signal);
        const source = METADATA_SOURCES[next]!;
        try {
          const result = await adapter.runSuiteQL(source.sql, {
            accountId,
            maxRows: 5000,
            signal: run.signal,
          });
          throwIfCancelled(run.signal);
          const tables = mapMetadata(source.id, result.rows);
          state = await store.update(accountId, (previous) => ({
            ...previous,
            metadata: {
              tables: mergeMetadata(previous.metadata?.tables ?? [], tables),
              next: next + 1,
              indexedAt: Date.now(),
            },
          }));
          if (mounted.current) onLibrary(state);
        } catch (err) {
          throwIfCancelled(run.signal);
          if (mounted.current) setError(toSuiteLensError(err).toShape());
          // Keep the failed source pending for resume; attempt no further source after an error.
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (err) {
      if (!run.signal.aborted && mounted.current) setError(toSuiteLensError(err).toShape());
    } finally {
      if (mounted.current) setIndexing(false);
      if (controller.current === run) controller.current = undefined;
    }
  };
  const readFile = async (file: File | undefined, metadata = false) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Import is limited to 2 MB.');
      const text = await file.text();
      if (metadata) {
        const tables = z
          .array(MetadataTableSchema)
          .max(5000)
          .parse(JSON.parse(text))
          .map((table) => ({ ...table, source: 'imported' as const }));
        await update((previous) => ({
          ...previous,
          metadata: {
            ...previous.metadata,
            next: previous.metadata?.next ?? 0,
            indexedAt: Date.now(),
            tables: mergeMetadata(previous.metadata?.tables ?? [], tables),
          },
        }));
      } else {
        const snippets = importSnippets(text);
        await update((previous) => ({
          ...previous,
          snippets: [...previous.snippets, ...snippets],
        }));
      }
    } catch (err) {
      if (mounted.current) setError(toSuiteLensError(err).toShape());
    }
  };
  const body = (
    <div className="flex flex-col gap-2 p-3">
      {error && <ErrorPanel error={error} onRetry={() => setError(undefined)} />}
      <label className="text-xs text-fg-muted">
        {t('console.searchLibrary')}
        <input
          type="search"
          className={fieldClass}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <h3 className="text-xs font-semibold text-fg-muted">{t('console.history')}</h3>
      {library.history
        .filter((item) => item.sql.toLowerCase().includes(search.trim().toLowerCase()))
        .map((item, i) => (
          <Button key={`${item.at}:${i}`} onClick={() => apply(item.sql)}>
            <span className="min-w-0 whitespace-pre-wrap wrap-anywhere">
              <SearchHighlight
                text={`${new Date(item.at).toLocaleString()} · ${item.rows} · ${search.trim() ? item.sql : item.sql.slice(0, 60)}`}
                query={search}
              />
            </span>
          </Button>
        ))}
      <Button
        disabled={!library.history.length}
        onClick={() => void update((previous) => ({ ...previous, history: [] }))}
      >
        {t('console.clearHistory')}
      </Button>
      <h3 className="text-xs font-semibold text-fg-muted">{t('console.snippets')}</h3>
      <label className="text-xs text-fg-muted">
        {t('console.snippetName')}
        <input
          className={fieldClass}
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="text-xs text-fg-muted">
        {t('console.description')}
        <input
          className={fieldClass}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="text-xs text-fg-muted">
        {t('console.tags')}
        <input
          className={fieldClass}
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
      </label>
      <Button
        disabled={!name.trim() || !ConsoleSqlSchema.safeParse(sql).success}
        onClick={() =>
          void update((previous) => ({
            ...previous,
            snippets: [
              ...previous.snippets,
              {
                id: crypto.randomUUID(),
                name: name.trim(),
                description,
                tags: tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                sql,
                variables,
              },
            ],
          }))
        }
      >
        {t('console.saveSnippet')}
      </Button>
      {[...CONSOLE_EXAMPLES, ...library.snippets]
        .filter((item) =>
          `${item.name} ${item.description} ${item.tags.join(' ')} ${item.sql}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .map((item) => (
          <div key={item.id} className="flex flex-col gap-1">
            <div className="flex gap-1">
              <Button onClick={() => apply(item.sql, item.variables)}>
                <SearchHighlight text={item.name} query={search} />
              </Button>
              {library.snippets.some((snippet) => snippet.id === item.id) && (
                <Button
                  onClick={() =>
                    void update((previous) => ({
                      ...previous,
                      snippets: previous.snippets.filter((snippet) => snippet.id !== item.id),
                    }))
                  }
                >
                  {t('console.deleteSnippet')}
                </Button>
              )}
            </div>
            <p className="text-xs text-fg-subtlest">
              <SearchHighlight
                text={`${item.description} ${item.tags.join(', ')}`}
                query={search}
              />
            </p>
            {search.trim() && item.sql.toLowerCase().includes(search.trim().toLowerCase()) && (
              <pre className="whitespace-pre-wrap wrap-anywhere font-mono text-xs text-fg-muted">
                <SearchHighlight text={item.sql} query={search} />
              </pre>
            )}
          </div>
        ))}
      <Button
        onClick={() =>
          downloadLocal(
            JSON.stringify({ version: 1, snippets: library.snippets }, null, 2),
            'suitelens-snippets.json',
            'application/json',
          )
        }
      >
        {t('console.exportSnippets')}
      </Button>
      <label className="text-xs text-fg-muted">
        {t('console.importSnippets')}
        <input
          type="file"
          className={fieldClass}
          accept=".json,application/json"
          onChange={(event) => {
            void readFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <h3 className="text-xs font-semibold text-fg-muted">{t('console.metadata')}</h3>
      <SectionMessage appearance="information">{t('console.metadataNotice')}</SectionMessage>
      <p role="status" className="text-xs text-fg-subtlest">
        {t('console.indexStatus', {
          count: library.metadata?.tables.length ?? 0,
          at: library.metadata?.indexedAt
            ? new Date(library.metadata.indexedAt).toLocaleString()
            : t('console.neverIndexed'),
        })}
      </p>
      <div className="flex gap-1">
        <Button disabled={indexing} onClick={() => void index()}>
          {t('console.index')}
        </Button>
        <Button disabled={!indexing} onClick={() => controller.current?.abort()}>
          {t('console.pauseIndex')}
        </Button>
        <Button
          disabled={indexing}
          onClick={() => void update((previous) => ({ ...previous, metadata: undefined }))}
        >
          {t('console.resetIndex')}
        </Button>
      </div>
      <label className="text-xs text-fg-muted">
        {t('console.importMetadata')}
        <input
          type="file"
          className={fieldClass}
          accept=".json,application/json"
          onChange={(event) => {
            void readFile(event.target.files?.[0], true);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
  if (drawer) return body;
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="px-2 py-1.5 hover:bg-muted">{t('console.tools')}</summary>
      {body}
    </details>
  );
}
