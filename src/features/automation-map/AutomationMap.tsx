import { SearchHighlight } from '../../shared/ui/SearchHighlight';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import type { AutomationItem, AutomationKind, PageContext } from '../../netsuite/types';
import {
  deploymentRecordUrl,
  fileCabinetUrl,
  scriptRecordUrl,
  workflowRecordUrl,
} from '../../netsuite/urls';
import { useAsync } from '../../shared/hooks/useAsync';
import { isMessageKey, t } from '../../shared/i18n';
import { getMetadataCache } from '../../shared/storage/cache';
import { formatRelativeTime, useNow } from '../../shared/time';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { cn } from '../../shared/ui/cn';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { fieldClass } from '../../shared/ui/field';
import { ChevronRightIcon, RefreshIcon } from '../../shared/ui/icons';
import { InfoTip } from '../../shared/ui/InfoTip';
import { Menu, type MenuItem } from '../../shared/ui/Menu';
import { ToggleChip } from '../../shared/ui/ToggleChip';
import { useAppStore, useFeatures } from '../../shared/store';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { Skeleton } from '../../shared/ui/Skeleton';
import { summarizeContexts } from './contexts';
import {
  EMPTY_AUTOMATION_FILTERS,
  filterAutomations,
  isExceptionalStatus,
  isRunning,
  runningFirst,
  type AutomationFilters,
} from './filter';
import { loadAutomationsCached } from './load';

const GROUPS: readonly AutomationKind[] = ['client', 'user_event', 'workflow_action', 'workflow'];

export function AutomationMap({
  adapter,
  context,
  onWhereUsed,
}: {
  onWhereUsed?: (identifier: string, files?: string[]) => void;
  adapter: NetSuiteAdapter;
  context: PageContext & { recordType: string };
}) {
  const key = `${adapter.kind}|${context.accountId}|${context.recordType}`;
  const state = useAsync(
    (force) =>
      loadAutomationsCached(
        adapter,
        getMetadataCache(),
        context.accountId,
        context.recordType,
        force,
      ),
    key,
  );
  const [filters, setFilters] = useState<AutomationFilters>(EMPTY_AUTOMATION_FILTERS);
  const [view, setView] = useState<'list' | 'timeline'>('list');
  const logsEnabled = useFeatures().logViewer;
  const openLogs = logsEnabled
    ? (script: string) => {
        useAppStore.getState().setLogsFilter({ accountId: context.accountId, script });
        useAppStore.getState().setActiveTab('logs');
      }
    : undefined;
  const query = useDeferredValue(filters.query);
  const now = useNow();
  // A script handoff from Logs ("Show in Automation") opens and scrolls to that card once.
  const [focus] = useState(() => {
    const handoff = useAppStore.getState().automationFocus;
    if (handoff) useAppStore.getState().setAutomationFocus(undefined);
    return handoff?.accountId === context.accountId ? handoff.scriptId.toLowerCase() : undefined;
  });
  const list = useRef<HTMLDivElement>(null);
  const loaded = state.status === 'success';
  useEffect(() => {
    if (!focus || !loaded) return;
    const card = [
      ...(list.current?.querySelectorAll<HTMLElement>('[data-automation-id]') ?? []),
    ].find((element) => element.dataset.automationId?.toLowerCase() === focus);
    if (!card) return;
    card.querySelector('details')?.setAttribute('open', '');
    card.scrollIntoView?.({ block: 'center' });
    card.setAttribute('data-focused', 'true');
  }, [focus, loaded]);

  const allItems = state.status === 'success' ? state.data.result.items : undefined;
  const items = useMemo(
    () => (allItems ? filterAutomations(allItems, { ...filters, query }) : []),
    [allItems, filters, query],
  );
  // Counts per group ignore the group filter, so every chip shows what it would reveal.
  const counts = useMemo(() => {
    const visible = allItems ? filterAutomations(allItems, { ...filters, query, kind: null }) : [];
    return new Map(GROUPS.map((kind) => [kind, visible.filter((i) => i.kind === kind).length]));
  }, [allItems, filters, query]);
  const scriptFileIds = useMemo(
    () => [
      ...new Set(
        (allItems ?? []).flatMap((i) =>
          i.kind !== 'workflow' && i.scriptFileId && /^[1-9][0-9]*$/.test(i.scriptFileId)
            ? [i.scriptFileId]
            : [],
        ),
      ),
    ],
    [allItems],
  );
  const presentGroups = GROUPS.filter((kind) => allItems?.some((i) => i.kind === kind));

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-canvas p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-fg">
              {t('automation.title', { recordType: context.recordType })}
            </h2>
            {state.status === 'success' && (
              <p
                className="text-xs text-fg-subtlest"
                title={new Date(state.data.storedAt).toLocaleString()}
              >
                {t(state.data.fromCache ? 'automation.cachedAt' : 'automation.fetchedAt', {
                  time: formatRelativeTime(state.data.storedAt, Math.max(now, state.data.storedAt)),
                })}
              </p>
            )}
          </div>
          {/* Actions keep their one-line labels; the heading takes the remaining width. */}
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            {onWhereUsed && scriptFileIds.length > 0 && (
              <Button
                variant="ghost"
                onClick={() =>
                  onWhereUsed(
                    '',
                    scriptFileIds.map((id) => `script:${id}`),
                  )
                }
              >
                {t('impact.planFromRecord', { count: scriptFileIds.length })}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => state.reload(true)}
              disabled={state.status === 'loading'}
            >
              <RefreshIcon />
              {t('app.refresh')}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder={t('automation.search')}
            aria-label={t('automation.search')}
            className={cn(fieldClass, 'min-w-0 flex-1')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ToggleChip
            pressed={filters.deployedOnly}
            onPressedChange={(deployedOnly) => setFilters({ ...filters, deployedOnly })}
          >
            {t('automation.filter.deployed')}
          </ToggleChip>
          {presentGroups.length > 1 && (
            <div role="group" aria-label={t('automation.filterKind')} className="contents">
              {presentGroups.map((kind) => (
                <ToggleChip
                  key={kind}
                  pressed={filters.kind === kind}
                  onPressedChange={(pressed) =>
                    setFilters({ ...filters, kind: pressed ? kind : null })
                  }
                >
                  {t(`automation.short.${kind}`)}
                  <span className="font-normal">{counts.get(kind)}</span>
                </ToggleChip>
              ))}
            </div>
          )}
          <span className="ml-auto flex items-center gap-1">
            <ToggleChip
              pressed={view === 'timeline'}
              onPressedChange={(pressed) => setView(pressed ? 'timeline' : 'list')}
              title={t('automation.timeline.title')}
            >
              {t('automation.timeline')}
            </ToggleChip>
            <InfoTip label={t('automation.approximate.label')} align="end">
              {t('automation.approximate')}
            </InfoTip>
          </span>
        </div>
      </div>

      <div ref={list} className="flex flex-col gap-2 p-3">
        {state.status === 'loading' && (
          <Skeleton label={t('app.loading')} variant="cards" count={5} />
        )}
        {state.status === 'error' && (
          <ErrorPanel error={state.error} onRetry={() => state.reload(true)} />
        )}
        {state.status === 'success' && (
          <>
            {state.data.result.warnings.map((w) => (
              <SectionMessage key={w} appearance="warning">
                {isMessageKey(w) ? t(w) : w}
              </SectionMessage>
            ))}
            {state.data.result.items.length === 0 ? (
              <EmptyState title={t('automation.empty')} />
            ) : items.length === 0 ? (
              <p className="py-3 text-center text-xs text-fg-muted">{t('automation.noMatches')}</p>
            ) : view === 'timeline' ? (
              <AutomationTimeline items={items} query={query} />
            ) : (
              GROUPS.map((kind) => {
                const group = runningFirst(items.filter((i) => i.kind === kind));
                if (group.length === 0) return null;
                return (
                  <section key={kind} aria-label={t(`automation.group.${kind}`)}>
                    <h3 className="mb-1 mt-1 text-xs font-semibold text-fg-muted">
                      {t(`automation.group.${kind}`)}{' '}
                      <span className="font-normal text-fg-subtlest">{group.length}</span>
                    </h3>
                    <ol className="flex flex-col gap-1">
                      {group.map((item) => (
                        <AutomationCard
                          key={`${item.internalId}-${item.deploymentInternalId ?? ''}`}
                          onWhereUsed={onWhereUsed}
                          onLogs={openLogs}
                          item={item}
                          query={query}
                          accountId={context.accountId}
                        />
                      ))}
                    </ol>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}

function statusTone(status?: string) {
  const s = status?.toUpperCase();
  if (s === 'TESTING') return 'warning' as const;
  if (s === 'NOTRUNNING' || s === 'NOT RUNNING') return 'danger' as const;
  return 'neutral' as const;
}

/** Collapsed: name, exceptions, script ID. Expanded: deployment details and links. */
function AutomationCard({
  item,
  accountId,
  query,
  onWhereUsed,
  onLogs,
}: {
  onWhereUsed?: (identifier: string, files?: string[]) => void;
  onLogs?: (script: string) => void;
  item: AutomationItem;
  accountId: string;
  query: string;
}) {
  const isWorkflow = item.kind === 'workflow';
  const running = isRunning(item);
  const links = isWorkflow
    ? [{ label: t('automation.openWorkflow'), href: workflowRecordUrl(accountId, item.internalId) }]
    : [
        { label: t('automation.openScript'), href: scriptRecordUrl(accountId, item.internalId) },
        {
          label: t('automation.openDeployment'),
          href: deploymentRecordUrl(accountId, item.deploymentInternalId),
        },
        { label: t('automation.openFile'), href: fileCabinetUrl(accountId, item.scriptFileId) },
      ];

  const available = links.filter((l): l is { label: string; href: string } => !!l.href);
  // The script (or workflow) link stays visible; deployment, file and "add file" go in the menu.
  const [primaryLink, ...otherLinks] = available;
  const menuItems: MenuItem[] = [
    ...(onWhereUsed && item.scriptFileId && /^[1-9][0-9]*$/.test(item.scriptFileId)
      ? [
          {
            label: t('impact.addFile'),
            description: item.scriptFileName ?? item.name,
            onSelect: () => onWhereUsed('', [`script:${item.scriptFileId}`]),
          },
        ]
      : []),
    ...otherLinks.map((l) => ({
      label: `${l.label} ↗`,
      onSelect: () => void window.open(l.href, '_blank', 'noopener,noreferrer'),
    })),
  ];

  return (
    <li
      className={cn(
        'rounded-lg border bg-surface text-xs data-[focused=true]:ring-2 data-[focused=true]:ring-focus',
        running ? 'border-line' : 'border-dashed border-line-input',
      )}
      data-automation-id={item.scriptId}
    >
      <details
        key={query.trim() ? 'search' : 'browse'}
        open={!!query.trim()}
        className="group/card"
      >
        <summary className="flex cursor-pointer list-none items-start gap-1.5 rounded-lg px-2 py-2 hover:bg-muted">
          <ChevronRightIcon className="mt-0.5 h-3.5 w-3.5 text-fg-muted transition-transform group-open/card:rotate-90 motion-reduce:transition-none" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1">
              <span className={cn('font-semibold', running ? 'text-fg' : 'text-fg-muted')}>
                <SearchHighlight text={item.name} query={query} />
              </span>
              {isExceptionalStatus(item.status) && (
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              )}
              {item.isDeployed === false && (
                <Badge tone="danger">{t('automation.notDeployed')}</Badge>
              )}
              {item.isInactive && <Badge tone="danger">{t('automation.inactive')}</Badge>}
            </span>
            {item.scriptId && (
              <span className="block font-mono break-all text-fg-muted">
                <SearchHighlight text={item.scriptId} query={query} />
              </span>
            )}
          </span>
        </summary>
        <div className="px-2 pb-2 pl-7">
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-fg-muted">
            {item.deploymentId && (
              <>
                <dt>{t('automation.deployment')}</dt>
                <dd className="font-mono break-all text-fg">
                  <SearchHighlight text={item.deploymentId} query={query} />
                </dd>
              </>
            )}
            {item.logLevel && (
              <>
                <dt>{t('automation.logLevel')}</dt>
                <dd className="text-fg">{item.logLevel}</dd>
              </>
            )}
            {item.executionContexts && item.executionContexts.length > 0 && (
              <>
                <dt>{t('automation.contexts')}</dt>
                <dd className="text-fg">
                  <ContextList contexts={item.executionContexts} />
                </dd>
              </>
            )}
            {item.trigger && (
              <>
                <dt>{t('automation.trigger')}</dt>
                <dd className="text-fg">{item.trigger}</dd>
              </>
            )}
            {item.scriptFileName && (
              <>
                <dt>{t('automation.openFile')}</dt>
                <dd className="font-mono break-all text-fg">
                  <SearchHighlight text={item.scriptFileName} query={query} />
                </dd>
              </>
            )}
          </dl>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {onWhereUsed && item.scriptId && (
              <Button
                spacing="compact"
                onClick={() => onWhereUsed(item.scriptId!)}
                aria-label={t('impact.whereUsedFor', { identifier: item.scriptId })}
              >
                {t('impact.title')}
              </Button>
            )}
            {onLogs && !isWorkflow && item.scriptId && (
              <Button
                spacing="compact"
                variant="ghost"
                onClick={() => onLogs(item.scriptId!)}
                aria-label={t('automation.logsFor', { name: item.scriptId })}
              >
                {t('tabs.logs')}
              </Button>
            )}
            {primaryLink && (
              <a
                href={primaryLink.href}
                target="_blank"
                rel="noreferrer noopener"
                className="px-1 text-accent underline-offset-2 hover:underline"
              >
                {primaryLink.label} ↗
              </a>
            )}
            {menuItems.length > 0 && (
              <Menu
                label={t('automation.moreActions', { name: item.name })}
                items={menuItems}
                className="ml-auto"
              />
            )}
          </div>
        </div>
      </details>
    </li>
  );
}

/** NetSuite lists every context for "All"; summarize so cards stay short. */
function ContextList({ contexts }: { contexts: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeContexts(contexts);
  const full = contexts.join(', ');
  if (summary.kind === 'all') return <span title={full}>{t('automation.contexts.all')}</span>;
  if (summary.kind === 'allExcept') {
    return (
      <span title={full}>
        {t('automation.contexts.allExcept', { list: summary.missing.join(', ') })}
      </span>
    );
  }
  const shown = expanded ? [...summary.shown, ...summary.hidden] : summary.shown;
  return (
    <span>
      {shown.join(', ')}
      {summary.hidden.length > 0 && (
        <>
          {' '}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="text-accent underline-offset-2 hover:underline"
          >
            {expanded
              ? t('automation.contexts.less')
              : t('automation.contexts.more', { count: summary.hidden.length })}
          </button>
        </>
      )}
    </span>
  );
}

/**
 * Timeline view: automations in the order NetSuite runs the stages for one save from the UI.
 * Within a stage the order stays approximate (see the ⓘ next to the view toggle).
 */
// VERIFY: Workflows can also trigger before load / before submit; the stage order below is the
// common case (client → user event → workflow action → workflow) and is labelled approximate.
function AutomationTimeline({ items, query }: { items: AutomationItem[]; query: string }) {
  const stages = GROUPS.map((kind) => ({
    kind,
    items: runningFirst(items.filter((i) => i.kind === kind)),
  })).filter((stage) => stage.items.length > 0);
  return (
    <ol aria-label={t('automation.timeline')} className="flex flex-col">
      {stages.map((stage, index) => (
        <li key={stage.kind} className="relative flex gap-3 pb-3">
          {index < stages.length - 1 && (
            <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-line" />
          )}
          <span className="z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-selected text-xs font-semibold text-accent">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold text-fg">{t(`automation.stage.${stage.kind}`)}</p>
            <p className="text-fg-subtlest">{t(`automation.group.${stage.kind}`)}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {stage.items.map((item) => (
                <li
                  key={`${item.internalId}-${item.deploymentInternalId ?? ''}`}
                  className={cn(
                    'flex flex-wrap items-center gap-1',
                    !isRunning(item) && 'opacity-60',
                  )}
                >
                  <span className="font-medium text-fg">
                    <SearchHighlight text={item.name} query={query} />
                  </span>
                  {item.trigger && <Badge>{item.trigger}</Badge>}
                  {isExceptionalStatus(item.status) && (
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}
