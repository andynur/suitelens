import { useEffect, useId, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError, toSuiteLensError } from '../../netsuite/errors';
import { loadExecutionLogs, type ExecutionLog } from '../../netsuite/queries/logs';
import { isRecordPage } from '../../netsuite/context/detect';
import type { PageContext } from '../../netsuite/types';
import { scriptRecordUrl, deploymentRecordUrl } from '../../netsuite/urls';
import { getTargetTab } from '../../shared/messaging';
import type { AsyncState } from '../../shared/hooks/useAsync';
import { useAccountSettings } from '../../shared/hooks/useAccountSettings';
import { t } from '../../shared/i18n';
import { formatRelativeTime, useNow, zonedTimeToEpoch } from '../../shared/time';
import { Button, IconButton } from '../../shared/ui/Button';
import { cn } from '../../shared/ui/cn';
import { DownloadIcon, FilterIcon, GotoIcon, RefreshIcon } from '../../shared/ui/icons';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { Skeleton } from '../../shared/ui/Skeleton';
import { fieldClass } from '../../shared/ui/field';
import { SearchHighlight } from '../../shared/ui/SearchHighlight';
import { useAppStore, useFeatures } from '../../shared/store';
import { getMetadataCache } from '../../shared/storage/cache';
import { Badge } from '../../shared/ui/Badge';
import { InfoTip } from '../../shared/ui/InfoTip';
import { ToggleChip } from '../../shared/ui/ToggleChip';
import { loadAutomationsCached } from '../automation-map/load';
import { ExplainError } from '../ai/explain/ExplainError';
import { MAX_EXPLAIN_LOGS } from '../ai/prompts/explainError';
import { exportResults, downloadLocal } from '../suiteql-console/export';
import { EMPTY_LOG_FILTERS, filterLogs, groupLogs, prettyLogDetail, type LogFilters } from './logs';

type Logs = Awaited<ReturnType<typeof loadExecutionLogs>>;
/** Logs stay in memory; Panel keys this component by adapter/account/page. */
export function LogViewer({
  adapter,
  context,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AsyncState<Logs>>({ status: 'loading' });
  // A script handoff from Automation ("Logs" on a card) prefills the script filter once.
  const [handoff] = useState(() => {
    const filter = useAppStore.getState().logsFilter;
    if (filter) useAppStore.getState().setLogsFilter(undefined);
    return filter?.accountId === context.accountId ? filter.script : '';
  });
  const [filters, setFilters] = useState<LogFilters>({ ...EMPTY_LOG_FILTERS, script: handoff });
  const [selecting, setSelecting] = useState(false);
  const [scopeChoice, setScopeChoice] = useState<'record' | 'all'>();
  const automationMap = useFeatures().automationMap;
  // Relative times only when the user set the zone log times are written in (Settings).
  const { logTimeZone } = useAccountSettings(context.accountId);
  const now = useNow(60_000);
  const ago = (loggedat: string) => {
    const epoch = logTimeZone ? zonedTimeToEpoch(loggedat, logTimeZone) : undefined;
    return epoch === undefined ? undefined : formatRelativeTime(epoch, now);
  };
  const recordType = isRecordPage(context) ? context.recordType : undefined;
  /** Script IDs deployed on this record type (Automation Map cache), for the scope control. */
  const [recordScripts, setRecordScripts] = useState<Set<string>>();
  useEffect(() => {
    if (!recordType || !automationMap) return;
    let live = true;
    loadAutomationsCached(adapter, getMetadataCache(), context.accountId, recordType, false)
      .then((load) => {
        const ids = load.result.items.flatMap((item) =>
          item.kind !== 'workflow' && item.scriptId ? [item.scriptId.toLowerCase()] : [],
        );
        if (live) setRecordScripts(new Set(ids));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [adapter, context.accountId, recordType, automationMap]);
  const [grouped, setGrouped] = useState(true);
  const [refreshSeconds, setRefreshSeconds] = useState(0);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const filtersId = useId();
  const aiAssist = useFeatures().aiAssist;
  /** Group keys selected for Explain with AI (F-5.9); only visible groups count. */
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const checkTarget = async () => {
      const current = await adapter.getPageContext();
      if (current?.accountId !== context.accountId || current.url !== context.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed while loading logs.');
    };
    void (async () => {
      await checkTarget();
      const data = await loadExecutionLogs(adapter, context.accountId, controller.signal);
      await checkTarget();
      if (!controller.signal.aborted) setState({ status: 'success', data });
    })().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setState({ status: 'error', error: toSuiteLensError(error).toShape() });
        setRefreshSeconds(0);
      }
    });
    return () => controller.abort();
  }, [adapter, context.accountId, context.url, attempt]);
  useEffect(() => {
    if (refreshSeconds < 30 || state.status === 'loading') return;
    // A timeout after settling prevents overlaps, even if a read takes longer than the interval.
    const timer = setTimeout(() => {
      setState({ status: 'loading' });
      setAttempt((n) => n + 1);
    }, refreshSeconds * 1000);
    return () => clearTimeout(timer);
  }, [refreshSeconds, state]);
  const recordLogs = useMemo(
    () =>
      recordScripts && recordScripts.size
        ? (state.data?.items ?? []).filter((item) =>
            recordScripts.has((item.scriptid ?? '').toLowerCase()),
          )
        : [],
    [state.data, recordScripts],
  );
  const showAutomation = (scriptId: string) => {
    useAppStore.getState().setAutomationFocus({ accountId: context.accountId, scriptId });
    useAppStore.getState().setActiveTab('automation');
  };
  // VERIFY: Script IDs from the Automation Map query match the log query's script ID column.
  // "This record type" is the default only when those scripts have logs; otherwise all scripts.
  const scopeAvailable = recordLogs.length > 0 && !handoff;
  const scope = scopeAvailable ? (scopeChoice ?? 'record') : 'all';
  // Error count for the Tools/Logs badge, from the logs this tab already loaded.
  useEffect(() => {
    if (state.status !== 'success') return;
    const count = state.data.items.filter(
      (item) => item.level === 'ERROR' || item.level === 'EMERGENCY',
    ).length;
    useAppStore.getState().setLogErrors({ accountId: context.accountId, count });
  }, [state, context.accountId]);
  const filtered = useMemo(
    () => filterLogs(scope === 'record' ? recordLogs : (state.data?.items ?? []), filters),
    [state.data, filters, scope, recordLogs],
  );
  const groups = useMemo(
    () =>
      grouped ? groupLogs(filtered) : filtered.map((item) => ({ key: item.id, items: [item] })),
    [grouped, filtered],
  );
  const selectedGroups = useMemo(
    () => groups.filter((group) => selected.includes(group.key)).slice(0, MAX_EXPLAIN_LOGS),
    [groups, selected],
  );
  const toggleSelected = (key: string, checked: boolean) =>
    setSelected((previous) =>
      checked ? [...previous.filter((k) => k !== key), key] : previous.filter((k) => k !== key),
    );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(groups.length / 100) - 1));
  const pageGroups = groups.slice(currentPage * 100, (currentPage + 1) * 100);
  const changeFilter = (key: keyof LogFilters, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(0);
  };
  const refresh = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };
  const invalidRange = !!filters.from && !!filters.to && filters.from > filters.to;
  const advancedCount = (['script', 'deployment', 'from', 'to'] as const).filter(
    (key) => filters[key],
  ).length;
  const hasDeploymentMetadata = state.data?.items.some(
    (item) => item.deploymentinternalid !== null || item.deploymentid !== null,
  );
  return (
    <>
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-canvas p-3">
        <h2 className="sr-only">{t('logs.title')}</h2>
        <div className="flex items-center gap-2">
          <input
            type="search"
            aria-label={t('logs.text')}
            placeholder={t('logs.text')}
            value={filters.text}
            className={cn(fieldClass, 'min-w-0 flex-1')}
            onChange={(e) => changeFilter('text', e.target.value)}
          />
          <select
            aria-label={t('logs.level')}
            className={cn(fieldClass, 'w-28 shrink-0')}
            value={filters.level}
            onChange={(e) => changeFilter('level', e.target.value)}
          >
            <option value="">{t('logs.allLevels')}</option>
            {['DEBUG', 'AUDIT', 'ERROR', 'EMERGENCY'].map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
          <Button
            isSelected={showFilters || advancedCount > 0}
            aria-expanded={showFilters}
            aria-controls={filtersId}
            onClick={() => setShowFilters((open) => !open)}
            className="shrink-0"
          >
            <FilterIcon className="h-3.5 w-3.5" />
            {advancedCount ? t('logs.filters.count', { count: advancedCount }) : t('logs.filters')}
          </Button>
          {state.status === 'success' && !hasDeploymentMetadata && (
            <InfoTip label={t('logs.deploymentInfo')} align="end">
              {t('logs.deploymentUnavailable')}
            </InfoTip>
          )}
        </div>
        {showFilters && (
          <div id={filtersId} className="grid grid-cols-2 gap-2">
            {(['script', 'deployment', 'from', 'to'] as const).map((key) => (
              <label className="text-xs text-fg-muted" key={key}>
                {t(`logs.${key}`)}
                <input
                  type={key === 'from' || key === 'to' ? 'datetime-local' : 'text'}
                  className={`${fieldClass} w-full`}
                  value={filters[key]}
                  disabled={key === 'deployment' && !hasDeploymentMetadata}
                  onChange={(e) => changeFilter(key, e.target.value)}
                />
              </label>
            ))}
            <label className="text-xs text-fg-muted">
              {t('logs.autoRefresh')}
              <select
                aria-label={t('logs.autoRefresh')}
                className={`${fieldClass} w-full`}
                value={refreshSeconds}
                onChange={(e) => setRefreshSeconds(Number(e.target.value))}
              >
                {[0, 30, 60, 120].map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds ? t('logs.interval', { seconds }) : t('logs.off')}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {scopeAvailable && (
            <select
              aria-label={t('logs.scopeControl')}
              className={cn(fieldClass, 'w-auto py-0 text-xs')}
              value={scope}
              onChange={(e) => {
                setScopeChoice(e.target.value as 'record' | 'all');
                setPage(0);
              }}
            >
              <option value="record">
                {t('logs.scope.record', { recordType: recordType ?? '' })}
              </option>
              <option value="all">{t('logs.scope.all')}</option>
            </select>
          )}
          <span className="text-xs text-fg-subtlest">
            {t('logs.count', {
              count: filtered.length,
              total: scope === 'record' ? recordLogs.length : (state.data?.items.length ?? 0),
            })}
            {state.status === 'success' && state.data.limited && (
              <span className="text-warning"> · {t('logs.limitedShort')}</span>
            )}
          </span>
          <IconButton
            label={t('app.refresh')}
            icon={<RefreshIcon className="h-3.5 w-3.5" />}
            disabled={state.status === 'loading'}
            onClick={refresh}
          />
          <span className="ml-auto flex items-center gap-1">
            <ToggleChip
              pressed={grouped}
              onPressedChange={(next) => {
                setGrouped(next);
                setPage(0);
                setSelected([]);
              }}
            >
              {t('logs.group')}
            </ToggleChip>
            {aiAssist && (
              <ToggleChip
                pressed={selecting}
                onPressedChange={(next) => {
                  setSelecting(next);
                  if (!next) setSelected([]);
                }}
              >
                {t('logs.selectForAi')}
              </ToggleChip>
            )}
            <Button
              variant="ghost"
              spacing="compact"
              aria-label={t('logs.export')}
              title={t('logs.export')}
              disabled={!filtered.length || invalidRange || state.status !== 'success'}
              onClick={() =>
                downloadLocal(
                  exportResults(filtered, 'csv'),
                  `suitelens-${context.accountId}-logs.csv`,
                  'text/csv;charset=utf-8',
                )
              }
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              {t('logs.exportShort')}
            </Button>
            <IconButton
              label={t('logs.fullPage')}
              icon={<GotoIcon className="h-3.5 w-3.5" />}
              onClick={() =>
                void getTargetTab()
                  .then((tab) => {
                    if (tab)
                      return browser.tabs.create({
                        url: browser.runtime.getURL('/logs.html') + `?targetTab=${tab.id}`,
                      });
                  })
                  .catch((error: unknown) =>
                    setState({ status: 'error', error: toSuiteLensError(error).toShape() }),
                  )
              }
            />
          </span>
        </div>
      </div>
      <div className="@container flex flex-col gap-2 p-3">
        {invalidRange && (
          <SectionMessage appearance="warning">{t('logs.invalidRange')}</SectionMessage>
        )}
        {state.status === 'loading' && <Skeleton variant="rows" label={t('app.loading')} />}
        {state.status === 'error' && <ErrorPanel error={state.error} onRetry={refresh} />}
        {state.status === 'success' && (
          <>
            {!state.data.items.length ? (
              <EmptyState title={t('logs.empty')} body={t('logs.emptyBody')} />
            ) : !filtered.length ? (
              <p className="text-xs text-fg-muted">{t('logs.noMatches')}</p>
            ) : (
              <>
                {aiAssist && selecting && (
                  <ExplainError
                    adapter={adapter}
                    groups={selectedGroups.map((group) => group.items)}
                    onClear={() => setSelected([])}
                  />
                )}
                {/* Full page (≥ 1000px): two columns of log groups. */}
                <ul
                  aria-label={t('logs.list')}
                  className="flex flex-col gap-2 @[1000px]:grid @[1000px]:grid-cols-2 @[1000px]:items-start"
                >
                  {pageGroups.map((group, index) => {
                    const first = group.items[0]!;
                    const day = first.loggedat.slice(0, 10);
                    const newDay =
                      index === 0 || pageGroups[index - 1]!.items[0]!.loggedat.slice(0, 10) !== day;
                    const isError = first.level === 'ERROR' || first.level === 'EMERGENCY';
                    return (
                      <li key={group.key} className="flex flex-col gap-1">
                        {newDay && (
                          <p className="sticky top-0 z-[1] -mx-3 bg-canvas px-3 py-0.5 text-xs font-semibold text-fg-subtlest">
                            {day}
                          </p>
                        )}
                        <div className="flex items-start gap-2">
                          {aiAssist && selecting && (
                            <input
                              type="checkbox"
                              className="mt-2"
                              aria-label={t('ai.explain.error.select', { title: first.title })}
                              checked={selectedGroups.includes(group)}
                              disabled={
                                !selectedGroups.includes(group) &&
                                selectedGroups.length >= MAX_EXPLAIN_LOGS
                              }
                              onChange={(e) => toggleSelected(group.key, e.target.checked)}
                            />
                          )}
                          <details
                            className={cn(
                              'min-w-0 flex-1 rounded-lg border border-line bg-surface text-xs',
                              isError && 'border-l-2 border-l-danger',
                            )}
                          >
                            <summary className="cursor-pointer px-2 py-1.5 hover:bg-muted">
                              <span className="inline-flex flex-wrap items-center gap-1">
                                <Badge tone={levelTone(first.level)}>{first.level}</Badge>
                                <span className="font-semibold">
                                  <SearchHighlight text={first.title} query={filters.text} />
                                </span>
                                {group.items.length > 1 && (
                                  <span className="text-fg-muted">
                                    {t('logs.occurrences', { count: group.items.length })}
                                  </span>
                                )}
                              </span>
                              <p className="text-fg-subtlest">
                                <span title={first.loggedat}>{first.loggedat.slice(11)}</span>
                                {ago(first.loggedat) && ` · ${ago(first.loggedat)}`} ·{' '}
                                <span className="wrap-anywhere">{first.scriptid}</span>
                              </p>
                            </summary>
                            <div className="flex flex-col gap-2 p-3">
                              {group.items.map((item) => (
                                <LogDetail
                                  key={item.id}
                                  item={item}
                                  relative={ago(item.loggedat)}
                                  accountId={context.accountId}
                                  search={filters.text}
                                  onShowAutomation={
                                    recordScripts?.has((item.scriptid ?? '').toLowerCase())
                                      ? showAutomation
                                      : undefined
                                  }
                                />
                              ))}
                            </div>
                          </details>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center gap-2">
                  <Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                    {t('logs.previous')}
                  </Button>
                  <span className="text-xs">
                    {t('logs.page', {
                      page: currentPage + 1,
                      total: Math.ceil(groups.length / 100),
                    })}
                  </span>
                  <Button
                    disabled={(currentPage + 1) * 100 >= groups.length}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    {t('logs.next')}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        {/* Limits that apply to every read: a quiet footer instead of a banner above the logs. */}
        <p className="text-xs text-fg-subtlest">
          {t('logs.retention')} {t('logs.scope')}
        </p>
      </div>
    </>
  );
}
function levelTone(level: string) {
  if (level === 'ERROR' || level === 'EMERGENCY') return 'danger' as const;
  if (level === 'AUDIT') return 'info' as const;
  return 'neutral' as const;
}

function LogDetail({
  item,
  relative,
  accountId,
  search,
  onShowAutomation,
}: {
  item: ExecutionLog;
  /** "3 hours ago" when the account log time zone is set. */
  relative?: string;
  accountId: string;
  search: string;
  /** Set when the script is deployed on the page's record type (Automation Map cache). */
  onShowAutomation?: (scriptId: string) => void;
}) {
  const pretty = prettyLogDetail(item.detail);
  return (
    <article className="rounded-lg border border-line p-3">
      <p className="text-fg-subtlest">
        {item.loggedat}
        {relative && ` (${relative})`} · #{item.id}
      </p>
      <div className="my-1 flex flex-wrap gap-2">
        {item.scriptinternalid && (
          <a
            className="text-accent hover:underline"
            href={scriptRecordUrl(accountId, item.scriptinternalid)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('restlet.script', { id: item.scriptinternalid })} ↗
          </a>
        )}
        {item.deploymentinternalid && (
          <a
            className="text-accent hover:underline"
            href={deploymentRecordUrl(accountId, item.deploymentinternalid)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('restlet.deployment', { id: item.deploymentinternalid })} ↗
          </a>
        )}
        {onShowAutomation && item.scriptid && (
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => onShowAutomation(item.scriptid!)}
          >
            {t('logs.showInAutomation')}
          </button>
        )}
      </div>
      <pre aria-label={t('logs.detail')} className="whitespace-pre-wrap font-mono wrap-anywhere">
        <SearchHighlight text={pretty} query={search} />
      </pre>
    </article>
  );
}
