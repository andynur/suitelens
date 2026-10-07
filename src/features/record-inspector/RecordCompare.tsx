import { useMemo, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { readRecordPayload, type RecordPayloadNode } from '../../netsuite/parsers/recordPayload';
import type { PageContext } from '../../netsuite/types';
import { useAsync } from '../../shared/hooks/useAsync';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { fieldClass } from '../../shared/ui/field';
import { Skeleton } from '../../shared/ui/Skeleton';
import { comparePayloads } from './compare';
import { maskPayload } from './payloadExport';

export function RecordCompare({
  adapter,
  context,
  active,
  masked,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext & { recordType: string };
  active?: RecordPayloadNode;
  masked: boolean;
}) {
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<string>();
  const [all, setAll] = useState(false);
  const valid = /^\d{1,20}$/.test(input.trim()) && input.trim() !== context.recordId;
  const state = useAsync(
    async () =>
      readRecordPayload(
        await adapter.getRecordXml(
          { recordType: context.recordType, id: target! },
          context.accountId,
          { comparison: true },
        ),
        { recordType: context.recordType, id: target! },
      ).json,
    target
      ? JSON.stringify([
          context.accountId,
          context.recordType,
          context.recordId,
          context.url,
          target,
        ])
      : null,
  );
  const rows = useMemo(
    () =>
      active && state.data
        ? comparePayloads(
            masked ? maskPayload(active) : active,
            masked ? maskPayload(state.data) : state.data,
          )
        : undefined,
    [active, state.data, masked],
  );
  const visible = rows?.filter((row) => all || row.status !== 'same');
  return (
    <section
      aria-label={t('inspector.compare.title')}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
    >
      <h3 className="text-xs font-semibold text-fg-muted">{t('inspector.compare.title')}</h3>
      <p className="text-xs text-fg-subtlest">
        {t('inspector.compare.notice', {
          account: context.accountId,
          type: context.recordType,
          id: context.recordId ?? '',
        })}
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || !active) return;
          if (target === input.trim()) state.reload(true);
          else setTarget(input.trim());
        }}
      >
        <label className="text-xs font-semibold" htmlFor="compare-record-id">
          {t('inspector.compare.id')}
        </label>
        <input
          id="compare-record-id"
          className={`${fieldClass} w-full`}
          inputMode="numeric"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        {input && !valid && (
          <p className="text-xs text-fg-muted">{t('inspector.compare.invalid')}</p>
        )}
        <div className="flex flex-wrap gap-1">
          <Button type="submit" disabled={!valid || !active}>
            {t('inspector.compare.load')}
          </Button>
          {target && (
            <Button
              onClick={() => {
                setTarget(undefined);
                setInput('');
              }}
            >
              {t('inspector.compare.clear')}
            </Button>
          )}
        </div>
      </form>
      {target && state.status === 'loading' && <Skeleton variant="rows" label={t('app.loading')} />}
      {target && state.status === 'error' && (
        <ErrorPanel error={state.error} onRetry={() => state.reload(true)} />
      )}
      {visible && (
        <>
          <p className="text-xs text-fg-subtlest">
            {t('inspector.compare.result', {
              id: target!,
              count: String(rows!.filter((row) => row.status !== 'same').length),
            })}
          </p>
          <Button isSelected={all} aria-pressed={all} onClick={() => setAll(!all)}>
            {t('inspector.compare.all')}
          </Button>
          {!visible.length ? (
            <EmptyState
              title={t('inspector.compare.equal')}
              body={t('inspector.compare.equalBody')}
            />
          ) : (
            <>
              {visible.length > 1000 && (
                <p className="text-xs text-fg-muted">{t('inspector.compare.limit')}</p>
              )}
              <table
                aria-label={t('inspector.compare.table')}
                className="w-full table-fixed text-xs"
              >
                <thead>
                  <tr>
                    {(['field', 'active', 'target'] as const).map((key) => (
                      <th key={key} className="w-1/3 p-1 text-left font-semibold text-fg-muted">
                        {t(`inspector.compare.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.slice(0, 1000).map((row) => (
                    <tr key={row.path} className="border-b border-line hover:bg-muted">
                      <th scope="row" className="p-1 text-left font-normal wrap-anywhere">
                        <span className="font-mono">{row.path}</span>
                        <div className="text-fg-subtlest">
                          {t(`inspector.compare.${row.status}`)}
                        </div>
                      </th>
                      {[row.left, row.right].map((value, index) => (
                        <td
                          key={index}
                          className="p-1 align-top font-mono whitespace-pre-wrap wrap-anywhere"
                        >
                          {value === undefined
                            ? t('inspector.compare.missing')
                            : JSON.stringify(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </section>
  );
}
