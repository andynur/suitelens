import { useEffect, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError, toSuiteLensError } from '../../netsuite/errors';
import {
  loadTransactionGraph,
  transactionBranches,
  type TransactionBranch,
  type TransactionGraph,
} from '../../netsuite/queries/transactions';
import type { PageContext } from '../../netsuite/types';
import type { AsyncState } from '../../shared/hooks/useAsync';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { Skeleton } from '../../shared/ui/Skeleton';

/** Mounted with an account/record/adapter key by Inspector; no cache or persistence. */
export function RelatedTransactions({
  adapter,
  context,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext & { recordType: string };
}) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{
    attempt: number;
    value: AsyncState<TransactionGraph>;
  }>();
  const { accountId, recordId, recordType, url } = context;
  useEffect(() => {
    if (!attempt || !recordId) return;
    const controller = new AbortController();
    const assertContext = async () => {
      const current = await adapter.getPageContext();
      if (current?.accountId !== accountId || current.url !== url || current.recordId !== recordId)
        throw new SuiteLensError(
          'ACCOUNT_MISMATCH',
          'Target changed while loading related transactions.',
        );
    };
    void loadTransactionGraph(
      { id: recordId, number: recordId, type: recordType },
      async (sql, options) => {
        await assertContext();
        const result = await adapter.runSuiteQL(sql, options);
        await assertContext();
        return result;
      },
      { accountId, signal: controller.signal },
    ).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ attempt, value: { status: 'success', data } });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setSettled({
            attempt,
            value: { status: 'error', error: toSuiteLensError(error).toShape() },
          });
      },
    );
    return () => controller.abort();
  }, [adapter, accountId, recordId, recordType, url, attempt]);
  const state = settled?.attempt === attempt ? settled.value : undefined;
  const reload = () => setAttempt((value) => value + 1);
  return (
    <section
      aria-label={t('inspector.related.title')}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
    >
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-fg-muted">{t('inspector.related.title')}</h3>
        <span className="ml-auto">
          <Button spacing="compact" onClick={reload} disabled={attempt > 0 && !state}>
            {t(attempt ? 'inspector.related.refresh' : 'inspector.related.load')}
          </Button>
        </span>
      </div>
      {!attempt && <p className="text-xs text-fg-muted">{t('inspector.related.prompt')}</p>}
      {attempt > 0 && !state && <Skeleton variant="rows" label={t('app.loading')} />}
      {state?.status === 'error' && <ErrorPanel error={state.error} onRetry={reload} />}
      {state?.status === 'success' && (
        <>
          <p className="text-xs text-fg-subtlest">{t('inspector.related.notice')}</p>
          {state.data.limited && (
            <SectionMessage appearance="warning">{t('inspector.related.limited')}</SectionMessage>
          )}
          {state.data.edges.length ? (
            <div role="region" aria-label={t('inspector.related.tree')}>
              <TransactionTree
                branch={transactionBranches(state.data)}
                origin={new URL(url).origin}
              />
            </div>
          ) : (
            <EmptyState
              title={t('inspector.related.empty.title')}
              body={t('inspector.related.empty.body')}
            />
          )}
        </>
      )}
    </section>
  );
}

function TransactionTree({ branch, origin }: { branch: TransactionBranch; origin: string }) {
  // VERIFY: generic transaction redirect path for every returned transaction type.
  const href = `${origin}/app/accounting/transactions/transaction.nl?id=${encodeURIComponent(branch.node.id)}`;
  const label = (
    <>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-accent hover:underline"
      >
        {branch.node.number} ↗
      </a>
      <span className="ml-1 text-fg-subtlest">{branch.node.type}</span>
      {branch.direction && (
        <p className="text-fg-muted">
          {t(
            branch.direction === 'previous'
              ? 'inspector.related.previous'
              : 'inspector.related.next',
          )}
          {branch.linkType && ` · ${branch.linkType}`}
        </p>
      )}
      {branch.reference && <p className="text-fg-subtlest">{t('inspector.related.reference')}</p>}
    </>
  );
  if (!branch.children.length) return <div className="p-2 text-xs wrap-anywhere">{label}</div>;
  return (
    <details open className="rounded-lg border border-line bg-surface text-xs wrap-anywhere">
      <summary className="cursor-pointer px-2 py-1.5 hover:bg-muted">{label}</summary>
      <div className="flex flex-col gap-1 px-2 pb-1">
        {branch.children.map((child, index) => (
          <TransactionTree key={index} branch={child} origin={origin} />
        ))}
      </div>
    </details>
  );
}
