import { useState } from 'react';
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
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { summarizeContexts } from './contexts';
import { loadAutomationsCached } from './load';

const GROUPS: readonly AutomationKind[] = ['client', 'user_event', 'workflow_action', 'workflow'];

export function AutomationMap({
  adapter,
  context,
}: {
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

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-fg">
          {t('automation.title', { recordType: context.recordType })}
        </h2>
        <Button
          variant="ghost"
          onClick={() => state.reload(true)}
          disabled={state.status === 'loading'}
        >
          {t('app.refresh')}
        </Button>
      </div>

      {state.status === 'loading' && (
        <p className="py-6 text-center text-xs text-fg-muted">{t('app.loading')}</p>
      )}
      {state.status === 'error' && (
        <ErrorPanel error={state.error} onRetry={() => state.reload(true)} />
      )}
      {state.status === 'success' && (
        <>
          <p className="text-[11px] text-fg-muted">
            {t(state.data.fromCache ? 'automation.cachedAt' : 'automation.fetchedAt', {
              time: new Date(state.data.storedAt).toLocaleString(),
            })}
          </p>
          <p className="rounded bg-info/10 px-2 py-1 text-[11px] text-info">
            {t('automation.approximate')}
          </p>
          {state.data.result.warnings.map((w) => (
            <p key={w} className="rounded bg-warning/10 px-2 py-1 text-[11px] text-warning">
              {isMessageKey(w) ? t(w) : w}
            </p>
          ))}
          {state.data.result.items.length === 0 ? (
            <EmptyState title={t('automation.empty')} />
          ) : (
            GROUPS.map((kind) => {
              const items = state.data.result.items.filter((i) => i.kind === kind);
              if (items.length === 0) return null;
              return (
                <section key={kind} aria-label={t(`automation.group.${kind}`)}>
                  <h3 className="mb-1 mt-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                    {t(`automation.group.${kind}`)}
                  </h3>
                  <ol className="flex flex-col gap-1.5">
                    {items.map((item) => (
                      <AutomationCard
                        key={`${item.internalId}-${item.deploymentInternalId ?? ''}`}
                        item={item}
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
  );
}

function statusTone(status?: string) {
  const s = status?.toUpperCase();
  if (s === 'RELEASED') return 'success' as const;
  if (s === 'TESTING') return 'warning' as const;
  if (s === 'NOTRUNNING' || s === 'NOT RUNNING') return 'danger' as const;
  return 'neutral' as const;
}

function AutomationCard({ item, accountId }: { item: AutomationItem; accountId: string }) {
  const isWorkflow = item.kind === 'workflow';
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

  return (
    <li
      className="rounded-md border border-line bg-surface p-2 text-[11px]"
      data-automation-id={item.scriptId}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-semibold text-fg">{item.name}</span>
        {item.status && <Badge tone={statusTone(item.status)}>{item.status}</Badge>}
        {item.isDeployed === false && <Badge tone="danger">{t('automation.notDeployed')}</Badge>}
        {item.isInactive && <Badge tone="danger">{t('automation.inactive')}</Badge>}
      </div>
      {item.scriptId && <p className="font-mono break-all text-fg-muted">{item.scriptId}</p>}
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-fg-muted">
        {item.deploymentId && (
          <>
            <dt>{t('automation.deployment')}</dt>
            <dd className="font-mono break-all text-fg">{item.deploymentId}</dd>
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
            <dd className="font-mono break-all text-fg">{item.scriptFileName}</dd>
          </>
        )}
      </dl>
      <div className="mt-1 flex gap-2">
        {links
          .filter((l): l is { label: string; href: string } => !!l.href)
          .map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline-offset-2 hover:underline"
            >
              {l.label} ↗
            </a>
          ))}
      </div>
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
