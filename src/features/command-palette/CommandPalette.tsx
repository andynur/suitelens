import { useEffect, useId, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { PageContext } from '../../netsuite/types';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import { CONSOLE_EXAMPLES } from '../../netsuite/queries/consoleExamples';
import { getConsoleLibraryStorage, type Snippet } from '../../shared/storage/consoleLibrary';
import { useAppStore, useFeatures } from '../../shared/store';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { fieldClass } from '../../shared/ui/field';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { SearchHighlight } from '../../shared/ui/SearchHighlight';
import { Spinner } from '../../shared/ui/Spinner';
import { QuickGoto } from '../quick-goto/QuickGoto';
import { FEATURE_COMMANDS, parseNavigationCommand } from './commands';

type Command = { id: string; label: string; run: () => void | Promise<void> };
/** Local feature/snippet search. Navigation uses validated same-account URL builders. */
export function CommandPalette({
  context,
  onClose,
}: {
  context: PageContext | null;
  onClose: () => void;
}) {
  const features = useFeatures();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [error, setError] = useState<SuiteLensErrorShape>();
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    input.current?.focus();
    return () => {
      if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !previous.closest('[hidden]') &&
        !(
          previous.getAttribute('role') === 'tab' &&
          previous.getAttribute('data-state') !== 'active'
        )
      )
        previous.focus();
      else document.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.focus();
    };
  }, []);
  useEffect(() => {
    if (!context?.accountId || !features.suiteqlConsole) return;
    let cancelled = false;
    void getConsoleLibraryStorage()
      .load(context.accountId)
      .then((library) => {
        if (!cancelled) {
          setSnippets(library.snippets);
          setLibraryLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(toSuiteLensError(err).toShape());
          setLibraryLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [context?.accountId, features.suiteqlConsole]);
  const needle = query.trim().toLowerCase();
  const commands: Command[] = FEATURE_COMMANDS.filter(
    (item) => !item.feature || features[item.feature],
  ).map((item) => ({
    id: `feature:${item.tab}`,
    label: t(item.label),
    run: () => {
      useAppStore.getState().setActiveTab(item.tab);
      onClose();
    },
  }));
  if (context && features.suiteqlConsole) {
    for (const [source, items] of [
      ['example', CONSOLE_EXAMPLES],
      ['saved', snippets],
    ] as const) {
      for (const snippet of items)
        commands.push({
          id: `${source}:${snippet.id}`,
          label: t('palette.snippet', { name: snippet.name }),
          run: () => {
            useAppStore.getState().setConsoleDraft({
              accountId: context.accountId,
              sql: snippet.sql,
              variables: snippet.variables,
            });
            useAppStore.getState().setActiveTab('console');
            onClose();
          },
        });
    }
  }
  if (features.aiAssist)
    commands.push({
      id: 'ai',
      label: t('palette.ai'),
      run: () => {
        useAppStore.getState().setAiOpen(true);
        onClose();
      },
    });
  const filtered = commands.filter((item) => item.label.toLowerCase().includes(needle));
  // Field search: the typed text filters the Fields tab of the open record.
  if (context?.recordType && features.fieldExplorer && needle && !/\s/.test(query.trim()))
    filtered.push({
      id: `fields:${needle}`,
      label: t('palette.searchFields', { query: query.trim() }),
      run: () => {
        useAppStore
          .getState()
          .setFieldSearch({ accountId: context.accountId, query: query.trim() });
        useAppStore.getState().setActiveTab('record');
        onClose();
      },
    });
  const navigation = context ? parseNavigationCommand(context.accountId, query) : undefined;
  if (navigation)
    filtered.unshift({
      id: navigation.url,
      label: t(navigation.kind === 'script' ? 'palette.openScript' : 'palette.openRecord', {
        target: query.trim(),
      }),
      run: async () => {
        await browser.tabs.create({ url: navigation.url });
        onClose();
      },
    });
  const current = Math.min(index, Math.max(0, filtered.length - 1));
  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [listId, current, query]);
  const run = (command: Command | undefined) => {
    if (!command) return;
    try {
      const promise = command.run();
      if (promise) void promise.catch((err: unknown) => setError(toSuiteLensError(err).toShape()));
    } catch (err) {
      setError(toSuiteLensError(err).toShape());
    }
  };
  return (
    <section
      aria-label={t('palette.title')}
      className="flex shrink-0 flex-col gap-2 border-b border-line bg-surface-overlay p-3 shadow-overlay"
    >
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold">{t('palette.title')}</h2>
        <Button variant="ghost" onClick={onClose}>
          {t('app.close')}
        </Button>
      </div>
      <input
        ref={input}
        role="combobox"
        aria-label={t('palette.search')}
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={filtered.length ? `${listId}-${current}` : undefined}
        placeholder={t('palette.search')}
        className={`${fieldClass} w-full`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((value) =>
              filtered.length
                ? (value + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length
                : 0,
            );
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(filtered[current]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={t('palette.results')}
        className="max-h-48 overflow-y-auto rounded-lg border border-line text-xs"
      >
        {filtered.map((command, i) => (
          <li role="none" key={command.id}>
            <button
              type="button"
              role="option"
              id={`${listId}-${i}`}
              aria-selected={i === current}
              className={`w-full px-2 py-1.5 text-left hover:bg-muted ${i === current ? 'bg-selected text-accent' : 'text-fg'}`}
              onFocus={() => setIndex(i)}
              onClick={() => run(command)}
            >
              <SearchHighlight text={command.label} query={query} />
            </button>
          </li>
        ))}
      </ul>
      {!filtered.length && <p className="text-xs text-fg-muted">{t('palette.noMatches')}</p>}
      <p className="text-xs text-fg-subtlest">{t('palette.hint')}</p>
      {!context && <p className="text-xs text-fg-muted">{t('goto.noAccount')}</p>}
      {context && features.suiteqlConsole && !libraryLoaded && (
        <Spinner label={t('palette.loadingSnippets')} />
      )}
      {error && <ErrorPanel error={error} />}
      {context && features.quickGoto && (
        <details className="rounded-lg border border-line bg-surface">
          <summary className="cursor-pointer px-2 py-1.5 text-xs hover:bg-muted">
            {t('goto.title')}
          </summary>
          <QuickGoto accountId={context.accountId} defaultRecordType={context.recordType} />
        </details>
      )}
    </section>
  );
}
