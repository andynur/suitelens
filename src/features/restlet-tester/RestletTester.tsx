import { RequestBuilder } from './RequestBuilder';
import type { RestletDeployment } from '../../netsuite/queries/restlets';
import { useEffect, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError, toSuiteLensError } from '../../netsuite/errors';
import { loadRestletDeployments } from '../../netsuite/queries/restlets';
import type { PageContext } from '../../netsuite/types';
import { deploymentRecordUrl, scriptRecordUrl } from '../../netsuite/urls';
import type { AsyncState } from '../../shared/hooks/useAsync';
import { t } from '../../shared/i18n';
import { Badge } from '../../shared/ui/Badge';
import { Button, IconButton } from '../../shared/ui/Button';
import { CopyIcon, RefreshIcon } from '../../shared/ui/icons';
import { copyWithToast } from '../../shared/ui/clipboard';
import { useAppStore, useFeatures } from '../../shared/store';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { fieldClass } from '../../shared/ui/field';
import { SearchHighlight } from '../../shared/ui/SearchHighlight';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { Skeleton } from '../../shared/ui/Skeleton';

type Deployments = Awaited<ReturnType<typeof loadRestletDeployments>>;

/** Account/page/adapter keyed by Panel; deployment metadata stays in memory only. */
export function RestletTester({
  adapter,
  context,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
}) {
  const logsEnabled = useFeatures().logViewer;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RestletDeployment>();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{
    key: string;
    attempt: number;
    state: AsyncState<Deployments>;
  }>();
  const key = JSON.stringify([context.accountId, context.url]);
  useEffect(() => {
    const controller = new AbortController();
    const assertContext = async () => {
      const current = await adapter.getPageContext();
      if (current?.accountId !== context.accountId || current.url !== context.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed while loading RESTlets.');
    };
    void loadRestletDeployments(
      async (sql, options) => {
        await assertContext();
        const result = await adapter.runSuiteQL(sql, options);
        await assertContext();
        return result;
      },
      { accountId: context.accountId, signal: controller.signal },
    ).then(
      (data) => {
        if (!controller.signal.aborted)
          setSettled({ key, attempt, state: { status: 'success', data } });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setSettled({
            key,
            attempt,
            state: { status: 'error', error: toSuiteLensError(error).toShape() },
          });
      },
    );
    return () => controller.abort();
  }, [adapter, context.accountId, context.url, key, attempt]);
  const state = settled?.key === key && settled.attempt === attempt ? settled.state : undefined;
  const refresh = () => setAttempt((value) => value + 1);
  const needle = search.trim().toLowerCase();
  const filtered = state?.data?.items.filter((item) =>
    [
      item.name,
      item.scriptId,
      item.deploymentId,
      item.scriptInternalId,
      item.deploymentInternalId,
      item.status ?? '',
    ].some((value) => value.toLowerCase().includes(needle)),
  );
  return (
    <>
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-canvas p-3">
        <h2 className="sr-only">{t('restlet.title')}</h2>
        <input
          type="search"
          aria-label={t('restlet.search')}
          placeholder={t('restlet.search')}
          className={`${fieldClass} w-full`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex items-center gap-1">
          <p className="text-xs text-fg-subtlest">
            {state?.status === 'success' &&
              t('restlet.count', { count: filtered?.length ?? 0, total: state.data.items.length })}
          </p>
          <IconButton
            label={t('app.refresh')}
            icon={<RefreshIcon className="h-3.5 w-3.5" />}
            onClick={refresh}
            disabled={!state}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {selected && (
          <RequestBuilder
            key={JSON.stringify([context.accountId, context.url, selected.deploymentInternalId])}
            adapter={adapter}
            context={context}
            deployment={selected}
          />
        )}
        {!state && <Skeleton variant="cards" label={t('app.loading')} />}
        {state?.status === 'error' && <ErrorPanel error={state.error} onRetry={refresh} />}
        {state?.status === 'success' && (
          <>
            {state.data.limited && (
              <SectionMessage appearance="warning">{t('restlet.limited')}</SectionMessage>
            )}
            {!state.data.items.length ? (
              <EmptyState title={t('restlet.empty.title')} body={t('restlet.empty.body')} />
            ) : !filtered?.length ? (
              <p className="text-center text-xs text-fg-muted">{t('restlet.noMatches')}</p>
            ) : (
              <ul aria-label={t('restlet.list')} className="flex flex-col gap-2">
                {filtered.map((item) => (
                  <li
                    key={item.deploymentInternalId}
                    className={`rounded-lg border bg-surface p-3 text-xs wrap-anywhere ${item.inactive || !item.deployed ? 'border-dashed border-line-input' : 'border-line'}`}
                  >
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 text-xs font-semibold">
                        <SearchHighlight text={item.name} query={needle} />
                      </h3>
                      <Button
                        spacing="compact"
                        variant="primary"
                        isSelected={selected?.deploymentInternalId === item.deploymentInternalId}
                        disabled={item.inactive || !item.deployed}
                        onClick={() => setSelected(item)}
                      >
                        {t('restlet.buildRequest')}
                      </Button>
                    </div>
                    <div className="my-1 flex flex-wrap gap-1 empty:hidden">
                      {item.inactive && <Badge tone="warning">{t('restlet.inactive')}</Badge>}
                      {!item.deployed && <Badge tone="warning">{t('restlet.notDeployed')}</Badge>}
                      {item.status && !/^released$/i.test(item.status) && (
                        <Badge tone="neutral">
                          <SearchHighlight text={item.status} query={needle} />
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-fg-muted">
                      <SearchHighlight text={item.scriptId} query={needle} />
                    </p>
                    <p className="font-mono text-fg-muted">
                      <SearchHighlight text={item.deploymentId} query={needle} />
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-accent hover:underline"
                        title={t('restlet.copyUrl.title')}
                        onClick={() =>
                          void copyWithToast(
                            restletUrl(context.url, item.scriptId, item.deploymentId),
                          )
                        }
                      >
                        <CopyIcon className="h-3.5 w-3.5" />
                        {t('restlet.copyUrl')}
                      </button>
                      {logsEnabled && (
                        <button
                          type="button"
                          className="text-accent hover:underline"
                          aria-label={t('automation.logsFor', { name: item.scriptId })}
                          onClick={() => {
                            useAppStore.getState().setLogsFilter({
                              accountId: context.accountId,
                              script: item.scriptId,
                            });
                            useAppStore.getState().setActiveTab('logs');
                          }}
                        >
                          {t('tabs.logs')}
                        </button>
                      )}
                      <a
                        className="text-accent hover:underline"
                        target="_blank"
                        rel="noreferrer noopener"
                        href={scriptRecordUrl(context.accountId, item.scriptInternalId)}
                      >
                        {t('restlet.script', { id: item.scriptInternalId })} ↗
                      </a>
                      <a
                        className="text-accent hover:underline"
                        target="_blank"
                        rel="noreferrer noopener"
                        href={deploymentRecordUrl(context.accountId, item.deploymentInternalId)}
                      >
                        {t('restlet.deployment', { id: item.deploymentInternalId })} ↗
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}

/**
 * Same-origin RESTlet URL for this deployment (what the tester calls).
 * VERIFY: External callers may need the account's restlets.api.netsuite.com domain instead.
 */
function restletUrl(pageUrl: string, script: string, deploy: string): string {
  const url = new URL('/app/site/hosting/restlet.nl', new URL(pageUrl).origin);
  url.searchParams.set('script', script);
  url.searchParams.set('deploy', deploy);
  return url.href;
}
