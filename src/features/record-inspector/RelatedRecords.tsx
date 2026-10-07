import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { isTransactionType } from '../../netsuite/queries/transactions';
import type { PageContext } from '../../netsuite/types';
import { t } from '../../shared/i18n';
import { EmptyState } from '../../shared/ui/EmptyState';
import { RelatedTransactions } from './RelatedTransactions';

/** Record › Related: linked transactions for a saved transaction (loaded on demand). */
export function RelatedRecords({
  adapter,
  context,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext & { recordType: string };
}) {
  if (!context.recordId)
    return <EmptyState title={t('inspector.saved.title')} body={t('related.saved.body')} />;
  if (!isTransactionType(context.recordType))
    return <EmptyState title={t('related.none.title')} body={t('related.none.body')} />;
  return (
    <div className="p-3">
      <RelatedTransactions
        // A new account, record or page starts over; late answers are discarded.
        key={JSON.stringify([
          adapter.kind,
          context.accountId,
          context.recordType,
          context.recordId,
          context.url,
        ])}
        adapter={adapter}
        context={context}
      />
    </div>
  );
}
