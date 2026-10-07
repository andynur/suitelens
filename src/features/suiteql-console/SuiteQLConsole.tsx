import { browser } from 'wxt/browser';
import { getTargetTab } from '../../shared/messaging';
import {
  getConsoleLibraryStorage,
  EMPTY_LIBRARY,
  type ConsoleLibrary,
  type Snippet,
} from '../../shared/storage/consoleLibrary';
import { ConsoleTools } from './ConsoleTools';
import { exportResults, downloadLocal } from './export';
import { copyWithToast } from '../../shared/ui/clipboard';
import { useAppStore } from '../../shared/store';
import { useEffect, useId, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { formatDialect, plsql } from 'sql-formatter';
import { t } from '../../shared/i18n';
import {
  getQueryWorkspaceStorage,
  MAX_QUERY_TABS,
  MAX_QUERY_LENGTH,
  type QueryWorkspace,
} from '../../shared/storage/queryWorkspace';
import { Button, IconButton } from '../../shared/ui/Button';
import {
  ChevronDownIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  GotoIcon,
  HistoryIcon,
  PlusIcon,
  SettingsIcon,
} from '../../shared/ui/icons';
import { InfoTip } from '../../shared/ui/InfoTip';
import { Menu } from '../../shared/ui/Menu';
import { fieldClass } from '../../shared/ui/field';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { Spinner } from '../../shared/ui/Spinner';
import { SqlEditor } from './SqlEditor';
import { ResultsTable } from './ResultsTable';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import {
  validateConsoleSql,
  measureConsoleRun,
  placeholderCount,
  DEFAULT_MAX_ROWS,
  type ConsoleResult,
} from '../../netsuite/queries/console';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';

function newTab(number: number) {
  return { id: crypto.randomUUID(), name: t('console.queryName', { number }), sql: '' };
}
function emptyWorkspace(): QueryWorkspace {
  const tab = newTab(1);
  return { activeId: tab.id, tabs: [tab] };
}

export function SuiteQLConsole({
  accountId,
  adapter,
}: {
  accountId: string;
  adapter: NetSuiteAdapter;
}) {
  const [library, setLibrary] = useState<ConsoleLibrary>(EMPTY_LIBRARY);
  const [libraryFailed, setLibraryFailed] = useState(false);
  const [parameters, setParameters] = useState<Snippet['variables']>([]);
  const [maxRows, setMaxRows] = useState(DEFAULT_MAX_ROWS);
  const [editorHeight, setEditorHeight] = useState<number>();
  const [showOptions, setShowOptions] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const optionsId = useId();
  const [progress, setProgress] = useState(0);
  const libraryStore = getConsoleLibraryStorage();
  const [workspace, setWorkspace] = useState<QueryWorkspace>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formatFailed, setFormatFailed] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [execution, setExecution] = useState<{
    status: 'running' | 'success' | 'cancelled' | 'error';
    tabId: string;
    result?: ConsoleResult;
    error?: SuiteLensErrorShape;
    sql?: string;
    elapsedMs?: number;
  }>();
  const running = useRef<AbortController>(undefined);
  const editor = useRef<EditorView>(undefined);
  const mounted = useRef(false);
  const revision = useRef(0);
  const pendingDraft = useAppStore((state) => state.consoleDraft);
  const storage = getQueryWorkspaceStorage();

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void libraryStore
      .load(accountId)
      .then((value) => {
        if (!cancelled) setLibrary(value);
      })
      .catch(() => {
        if (!cancelled) setLibraryFailed(true);
      });
    void storage
      .load(accountId)
      .then((saved) => {
        if (cancelled) return;
        const next = saved ?? emptyWorkspace();
        setWorkspace(next);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      running.current?.abort();
      running.current = undefined;
    };
  }, [accountId, storage, libraryStore]);

  useEffect(() => {
    let active = true;
    const consume = () => {
      if (!active) return;
      const pending = useAppStore.getState().consoleDraft;
      if (
        !workspace ||
        !pending ||
        pending.accountId !== accountId ||
        workspace.tabs.length >= MAX_QUERY_TABS
      )
        return;
      useAppStore.getState().setConsoleDraft(undefined);
      running.current?.abort();
      running.current = undefined;
      setExecution(undefined);
      const tab = { ...newTab(workspace.tabs.length + 1), sql: pending.sql };
      const next = { tabs: [...workspace.tabs, tab], activeId: tab.id };
      setWorkspace(next);
      setParameters(pending.variables ?? []);
      void storage.save(accountId, next).catch(() => {
        if (mounted.current) setSaveFailed(true);
      });
    };
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.consoleDraft !== previous.consoleDraft) consume();
    });
    // Reconcile a draft queued before the asynchronous workspace became available.
    void Promise.resolve().then(consume);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [workspace, accountId, storage]);

  function cancel() {
    running.current?.abort();
    running.current = undefined;
    setExecution((previous) =>
      previous ? { status: 'cancelled', tabId: previous.tabId } : undefined,
    );
  }

  async function runQuery(selectionOnly = false, preferSelection = false, retrySql?: string) {
    const view = editor.current;
    if (!view || !workspace || running.current) return;
    const range = view.state.selection.main;
    const selected = view.state.sliceDoc(range.from, range.to);
    const sql =
      retrySql ??
      (selectionOnly || (preferSelection && selected.trim())
        ? selected
        : view.state.doc.toString());
    const tabId = workspace.activeId;
    const controller = new AbortController();
    running.current = controller;
    setProgress(0);
    setExecution({ status: 'running', tabId });
    try {
      validateConsoleSql(sql);
      const parameterOffset =
        selectionOnly || (preferSelection && selected.trim())
          ? placeholderCount(view.state.sliceDoc(0, range.from))
          : 0;
      const params = Array.from({ length: placeholderCount(sql) }, (_, index) => {
        const parameter = parameters[parameterOffset + index] ?? { type: 'string', value: '' };
        if (parameter.type === 'number') {
          if (!parameter.value.trim() || !Number.isFinite(Number(parameter.value)))
            throw new Error('Enter a finite number for each numeric parameter.');
          return Number(parameter.value);
        }
        if (parameter.type === 'boolean') {
          if (!['true', 'false'].includes(parameter.value))
            throw new Error('Boolean parameters must be true or false.');
          return parameter.value === 'true';
        }
        return parameter.value;
      });
      const { result, elapsedMs } = await measureConsoleRun(() =>
        adapter.runSuiteQL(sql, {
          accountId,
          params,
          maxRows,
          signal: controller.signal,
          onProgress: (count) => {
            if (mounted.current && running.current === controller) setProgress(count);
          },
        }),
      );
      if (!controller.signal.aborted)
        void saveHistory(sql, 'success', result.rows.length, elapsedMs);
      if (mounted.current && running.current === controller && !controller.signal.aborted)
        setExecution({
          status: 'success',
          tabId,
          result,
          elapsedMs: elapsedMs,
        });
    } catch (error) {
      if (!controller.signal.aborted) void saveHistory(sql, 'error', 0, 0);
      if (mounted.current && running.current === controller && !controller.signal.aborted)
        setExecution({ status: 'error', tabId, sql, error: toSuiteLensError(error).toShape() });
    } finally {
      if (running.current === controller) running.current = undefined;
    }
  }

  async function saveHistory(sql: string, status: 'success' | 'error', rows: number, ms: number) {
    if (!validateForHistory(sql)) return;
    try {
      const value = await libraryStore.update(accountId, (previous) => ({
        ...previous,
        history: [{ sql, at: Date.now(), status, rows, ms }, ...previous.history].slice(0, 100),
      }));
      if (mounted.current) {
        setLibrary(value);
        setLibraryFailed(false);
      }
    } catch {
      if (mounted.current) setLibraryFailed(true);
    }
  }
  function validateForHistory(sql: string) {
    try {
      validateConsoleSql(sql);
      return true;
    } catch {
      return false;
    }
  }
  function applySql(sql: string, variables: Snippet['variables'] = []) {
    const view = editor.current;
    if (!view) return;
    setParameters(variables);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: sql } });
    view.focus();
  }

  function update(next: QueryWorkspace) {
    if (workspace && workspace.activeId !== next.activeId) {
      running.current?.abort();
      running.current = undefined;
      setExecution(undefined);
      setParameters([]);
    }
    setWorkspace(next);
    setSaveFailed(false);
    setSaving(true);
    const current = ++revision.current;
    void storage
      .save(accountId, next)
      .then(() => {
        if (mounted.current && revision.current === current) setSaving(false);
      })
      .catch(() => {
        if (mounted.current && revision.current === current) {
          setSaveFailed(true);
          setSaving(false);
        }
      });
  }

  if (loadFailed)
    return (
      <div className="p-3">
        <SectionMessage
          appearance="error"
          role="alert"
          actions={
            <Button
              onClick={() => {
                setLoadFailed(false);
                update(emptyWorkspace());
              }}
            >
              {t('console.resetDrafts')}
            </Button>
          }
        >
          {t('console.loadFailed')}
        </SectionMessage>
      </div>
    );
  if (!workspace) return <Spinner label={t('app.loading')} />;
  const active = workspace.tabs.find((tab) => tab.id === workspace.activeId)!;

  function formatQuery() {
    const view = editor.current;
    if (!view) return;
    try {
      const formatted = formatDialect(view.state.doc.toString(), {
        dialect: plsql,
        keywordCase: 'upper',
      });
      if (formatted.length > MAX_QUERY_LENGTH) throw new Error('Formatted query too long');
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
      setFormatFailed(false);
      view.focus();
    } catch {
      setFormatFailed(true);
    }
  }

  return (
    <section className="@container flex flex-col gap-2 p-3" aria-label={t('console.title')}>
      <h2 className="sr-only">{t('console.title')}</h2>
      <div className="flex items-center gap-1">
        <div
          className="flex min-w-0 flex-1 flex-wrap gap-1"
          role="group"
          aria-label={t('console.queries')}
        >
          {workspace.tabs.map((tab) => (
            <span key={tab.id} className="inline-flex items-center">
              <Button
                spacing="compact"
                isSelected={tab.id === workspace.activeId}
                aria-pressed={tab.id === workspace.activeId}
                onClick={() => {
                  setFormatFailed(false);
                  update({ ...workspace, activeId: tab.id });
                }}
              >
                {tab.name}
              </Button>
              {/* Close sits on the active query tab, so it is clear what it closes. */}
              {tab.id === workspace.activeId && (
                <IconButton
                  label={t('console.closeQuery')}
                  icon={<CloseIcon className="h-3 w-3" />}
                  disabled={workspace.tabs.length === 1}
                  onClick={() => {
                    const tabs = workspace.tabs.filter((item) => item.id !== active.id);
                    update({ tabs, activeId: tabs[0]!.id });
                    setFormatFailed(false);
                  }}
                />
              )}
            </span>
          ))}
          <IconButton
            label={t('console.newQuery')}
            icon={<PlusIcon className="h-3.5 w-3.5" />}
            disabled={workspace.tabs.length >= MAX_QUERY_TABS}
            onClick={() => {
              const tab = newTab(workspace.tabs.length + 1);
              update({ activeId: tab.id, tabs: [...workspace.tabs, tab] });
            }}
          />
        </div>
        <Button
          variant="ghost"
          spacing="compact"
          aria-label={t('console.tools')}
          title={t('console.tools')}
          isSelected={showTools}
          aria-expanded={showTools}
          onClick={() => setShowTools((open) => !open)}
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          {t('console.historyShort')}
        </Button>
        <IconButton
          label={t('console.options')}
          icon={<SettingsIcon className="h-3.5 w-3.5" />}
          isSelected={showOptions}
          aria-expanded={showOptions}
          aria-controls={optionsId}
          onClick={() => setShowOptions((open) => !open)}
        />
        <IconButton
          label={t('console.fullTab')}
          icon={<GotoIcon className="h-3.5 w-3.5" />}
          onClick={() =>
            void getTargetTab()
              .then((tab) =>
                browser.tabs.create({
                  url:
                    browser.runtime.getURL('/console.html') + (tab ? `?targetTab=${tab.id}` : ''),
                }),
              )
              .catch((error) =>
                setExecution({
                  status: 'error',
                  tabId: active.id,
                  error: toSuiteLensError(error).toShape(),
                }),
              )
          }
        />
      </div>
      {showOptions && (
        <div
          id={optionsId}
          className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              {t('console.name')}
              <input
                className={fieldClass}
                value={active.name}
                maxLength={60}
                onChange={(event) => {
                  const name = event.target.value;
                  if (name.trim())
                    update({
                      ...workspace,
                      tabs: workspace.tabs.map((tab) =>
                        tab.id === active.id ? { ...tab, name } : tab,
                      ),
                    });
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              {t('console.maxRows')}
              <input
                type="number"
                min={1}
                max={100000}
                className={fieldClass}
                value={maxRows}
                onChange={(event) => setMaxRows(Number(event.target.value))}
              />
            </label>
          </div>
          <p className="text-xs text-fg-subtlest">{t('console.pagingNotice')}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {/* Split run button: the label follows the editor selection; the menu offers both. */}
        <span className="inline-flex items-center">
          <Button
            variant="primary"
            className="rounded-r-none"
            disabled={execution?.status === 'running' || !active.sql.trim()}
            title={t('console.runShortcut')}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            onClick={() => void runQuery(hasSelection)}
          >
            {t(hasSelection ? 'console.runSelection' : 'console.run')}
          </Button>
          <Menu
            align="start"
            label={t('console.runOptions')}
            icon={<ChevronDownIcon className="h-3.5 w-3.5" />}
            className="[&>button]:h-6 [&>button]:rounded-l-none [&>button]:bg-accent [&>button]:text-fg-inverse [&>button]:hover:bg-accent-hovered"
            items={[
              {
                label: t('console.run'),
                disabled: execution?.status === 'running' || !active.sql.trim(),
                onSelect: () => void runQuery(),
              },
              {
                label: t('console.runSelection'),
                disabled: execution?.status === 'running' || !hasSelection,
                onSelect: () => void runQuery(true),
              },
            ]}
          />
        </span>
        <Button variant="ghost" onClick={formatQuery} disabled={!active.sql.trim()}>
          {t('console.format')}
        </Button>
        {execution?.status === 'running' && (
          <Button variant="ghost" onClick={cancel}>
            {t('console.cancel')}
          </Button>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-fg-subtlest" role="status">
          {saveFailed ? t('console.saveFailed') : saving ? t('console.saving') : t('console.saved')}
          <InfoTip label={t('console.about')} align="end">
            {t('console.draftNotice')} {t('console.historyNotice')}
          </InfoTip>
        </span>
      </div>
      {/* Full tab (≥ 1000px): editor and parameters left, results right. */}
      <div className="flex flex-col gap-2 @[1000px]:grid @[1000px]:grid-cols-2 @[1000px]:items-start">
        <div className="flex min-w-0 flex-col gap-2">
          <SqlEditor
            key={active.id}
            initialSql={active.sql}
            tables={library.metadata?.tables ?? []}
            height={editorHeight}
            onHeightChange={setEditorHeight}
            onRun={() => void runQuery(false, true)}
            onSelectionChange={setHasSelection}
            onReady={(view) => {
              editor.current = view;
            }}
            onChange={(sql) => {
              setFormatFailed(false);
              update({
                ...workspace,
                tabs: workspace.tabs.map((tab) => (tab.id === active.id ? { ...tab, sql } : tab)),
              });
            }}
          />
          {placeholderCount(active.sql) > 0 && (
            <fieldset className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <legend className="text-xs font-semibold">{t('console.parameters')}</legend>
              {Array.from({ length: Math.min(100, placeholderCount(active.sql)) }, (_, index) => {
                const parameter = parameters[index] ?? {
                  name: `? ${index + 1}`,
                  type: 'string' as const,
                  value: '',
                };
                const change = (patch: Partial<Snippet['variables'][number]>) =>
                  setParameters((previous) =>
                    Array.from({ length: Math.min(100, placeholderCount(active.sql)) }, (_, i) => ({
                      ...(previous[i] ?? {
                        name: `? ${i + 1}`,
                        type: 'string' as const,
                        value: '',
                      }),
                      ...(i === index ? patch : {}),
                    })),
                  );
                return (
                  <div key={index} className="flex flex-col gap-1">
                    <label className="text-xs text-fg-muted">
                      {t('console.parameterName')} {index + 1}
                      <input
                        className={fieldClass}
                        maxLength={60}
                        value={parameter.name}
                        onChange={(event) => change({ name: event.target.value })}
                      />
                    </label>
                    <label className="text-xs text-fg-muted">
                      {t('console.parameterType')} {index + 1}
                      <select
                        className={fieldClass}
                        aria-label={`${t('console.parameterType')} ${index + 1}`}
                        value={parameter.type}
                        onChange={(event) =>
                          change({
                            type: event.target.value as 'string' | 'number' | 'boolean',
                            value: '',
                          })
                        }
                      >
                        <option value="string">{t('console.typeString')}</option>
                        <option value="number">{t('console.typeNumber')}</option>
                        <option value="boolean">{t('console.typeBoolean')}</option>
                      </select>
                    </label>
                    <label className="text-xs text-fg-muted">
                      {t('console.parameterValue')} {index + 1}
                      <input
                        className={fieldClass}
                        maxLength={1000}
                        value={parameter.value}
                        onChange={(event) => change({ value: event.target.value })}
                      />
                    </label>
                  </div>
                );
              })}
            </fieldset>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          {pendingDraft?.accountId === accountId && workspace.tabs.length >= MAX_QUERY_TABS && (
            <SectionMessage appearance="warning">{t('console.draftLimit')}</SectionMessage>
          )}
          {execution?.tabId === active.id && (
            <>
              {execution.status === 'running' && (
                <>
                  <Spinner label={t('console.running')} />
                  <progress
                    className="w-full accent-accent"
                    aria-label={t('console.running')}
                    max={maxRows}
                    value={progress}
                  />
                  <p role="status" className="text-xs text-fg-subtlest">
                    {t('console.progress', { count: progress })}
                  </p>
                </>
              )}
              {execution.status === 'cancelled' && (
                <p role="status" className="text-xs text-fg-muted">
                  {t('console.cancelled')}
                </p>
              )}
              {execution.error && (
                <ErrorPanel
                  error={execution.error}
                  onRetry={() => void runQuery(false, false, execution.sql)}
                />
              )}
              {execution.result && (
                <div className="flex flex-col gap-2">
                  <p role="status" className="text-xs text-fg-subtlest">
                    {t('console.resultSummary', {
                      count: execution.result.rows.length,
                      ms: execution.elapsedMs ?? 0,
                    })}
                  </p>
                  {execution.result.atLimit && (
                    <SectionMessage appearance="warning">{t('console.rowLimit')}</SectionMessage>
                  )}
                  {execution.result.rows.length === 0 && (
                    <EmptyState title={t('console.noRows.title')} body={t('console.noRows.body')} />
                  )}
                  {execution.result.rows.length > 0 && (
                    <>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          spacing="compact"
                          aria-label={t('console.exportCsv')}
                          onClick={() =>
                            downloadLocal(
                              exportResults(execution.result!.rows, 'csv'),
                              'suitelens-results.csv',
                              'text/csv;charset=utf-8',
                            )
                          }
                        >
                          <DownloadIcon className="h-3.5 w-3.5" />
                          {t('console.exportCsv.short')}
                        </Button>
                        <Button
                          variant="ghost"
                          spacing="compact"
                          aria-label={t('console.exportJson')}
                          onClick={() =>
                            downloadLocal(
                              exportResults(execution.result!.rows, 'json'),
                              'suitelens-results.json',
                              'application/json',
                            )
                          }
                        >
                          <DownloadIcon className="h-3.5 w-3.5" />
                          {t('console.exportJson.short')}
                        </Button>
                        <Button
                          variant="ghost"
                          spacing="compact"
                          aria-label={t('console.copyMarkdown')}
                          onClick={() =>
                            void copyWithToast(exportResults(execution.result!.rows, 'markdown'))
                          }
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                          {t('console.copyMarkdown.short')}
                        </Button>
                      </div>
                      <ResultsTable rows={execution.result.rows} />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showTools && (
        <aside
          aria-label={t('console.tools')}
          className="fixed inset-y-0 right-0 z-30 flex w-[min(28rem,92vw)] flex-col border-l border-line bg-canvas shadow-overlay"
        >
          <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-1.5">
            <h3 className="flex-1 text-sm font-semibold">{t('console.tools')}</h3>
            <IconButton
              label={t('app.close')}
              icon={<CloseIcon />}
              onClick={() => setShowTools(false)}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConsoleTools
              drawer
              accountId={accountId}
              adapter={adapter}
              library={library}
              onLibrary={setLibrary}
              sql={active.sql}
              variables={parameters}
              apply={(sql, variables) => {
                applySql(sql, variables);
                setShowTools(false);
              }}
            />
          </div>
        </aside>
      )}
      {libraryFailed && (
        <SectionMessage
          appearance="error"
          role="alert"
          actions={
            <Button
              onClick={() =>
                void libraryStore
                  .load(accountId)
                  .then((value) => {
                    setLibrary(value);
                    setLibraryFailed(false);
                  })
                  .catch(() => setLibraryFailed(true))
              }
            >
              {t('app.retry')}
            </Button>
          }
        >
          {t('console.libraryFailed')}
        </SectionMessage>
      )}
      {saveFailed && <Button onClick={() => update(workspace)}>{t('app.retry')}</Button>}
      {formatFailed && (
        <SectionMessage appearance="error" role="alert">
          {t('console.formatFailed')}
        </SectionMessage>
      )}
      <p id="suiteql-draft-notice" className="sr-only">
        {t('console.draftNotice')} {t('console.historyNotice')}
      </p>
    </section>
  );
}
