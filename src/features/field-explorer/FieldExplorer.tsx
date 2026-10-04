import { useDeferredValue, useMemo, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError } from '../../netsuite/errors';
import type { PageContext, RecordFieldInfo, RecordFieldsResult } from '../../netsuite/types';
import { useAsync } from '../../shared/hooks/useAsync';
import { isMessageKey, t } from '../../shared/i18n';
import { useAppStore } from '../../shared/store';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { copyWithToast } from '../../shared/ui/clipboard';
import { cn } from '../../shared/ui/cn';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { Switch } from '../../shared/ui/Switch';
import { COPY_FORMATS, formatFieldCopy, type CopyFormat } from './copy';
import { displayValue, partitionByForm } from './display';
import { EMPTY_FILTERS, filterFields, type FieldFilters } from './filter';

const COPY_LABEL = {
  id: 'record.copyFormat.id',
  quoted: 'record.copyFormat.quoted',
  snippet: 'record.copyFormat.snippet',
} as const;

const FILTER_TOGGLES = [
  ['customOnly', 'record.filter.custom'],
  ['mandatoryOnly', 'record.filter.mandatory'],
  ['nonEmptyOnly', 'record.filter.nonEmpty'],
] as const;

export function FieldExplorer({
  adapter,
  context,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext & { recordType: string };
}) {
  const settings = useAppStore((s) => s.settings);
  const saveSettings = useAppStore((s) => s.saveSettings);
  const [filters, setFilters] = useState<FieldFilters>(EMPTY_FILTERS);
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('id');
  const deferredQuery = useDeferredValue(filters.query);

  const key = `${context.accountId}|${context.recordType}|${context.recordId ?? ''}|${context.url}`;
  const state = useAsync(async (): Promise<RecordFieldsResult> => {
    const ref = context.recordId
      ? { recordType: context.recordType, id: context.recordId }
      : { recordType: context.recordType };
    const result = await adapter.getRecordFields(ref);
    // Never show data that belongs to another account (tab switched meanwhile).
    if (result.accountId !== context.accountId) {
      throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed.');
    }
    return result;
  }, key);

  const { customOnly, mandatoryOnly, nonEmptyOnly } = filters;
  const active = useMemo(
    () => ({ query: deferredQuery, customOnly, mandatoryOnly, nonEmptyOnly }),
    [deferredQuery, customOnly, mandatoryOnly, nonEmptyOnly],
  );
  const allFields = state.status === 'success' ? state.data.fields : undefined;
  const fields = useMemo(
    () => (allFields ? filterFields(allFields, active) : []),
    [allFields, active],
  );
  const hasPageLabels = state.status === 'success' && state.data.sources.includes('dom');
  const groups = useMemo(() => partitionByForm(fields, hasPageLabels), [fields, hasPageLabels]);
  const searching = active.query.trim() !== '';

  const onCopy = (fieldId: string, sublistId?: string) =>
    void copyWithToast(formatFieldCopy(fieldId, copyFormat, sublistId));

  return (
    <div className="flex flex-col gap-2 p-3">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        placeholder={t('record.search')}
        aria-label={t('record.search')}
        className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-2 focus:outline-accent"
      />
      <div className="flex flex-wrap items-center gap-1">
        {FILTER_TOGGLES.map(([name, labelKey]) => (
          <button
            key={name}
            type="button"
            aria-pressed={filters[name]}
            onClick={() => setFilters({ ...filters, [name]: !filters[name] })}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px]',
              filters[name]
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-line text-fg-muted hover:bg-muted',
            )}
          >
            {t(labelKey)}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[11px] text-fg-muted">
          {t('record.copyFormat')}
          <select
            value={copyFormat}
            onChange={(e) => setCopyFormat(e.target.value as CopyFormat)}
            className="rounded border border-line bg-surface px-1 py-0.5 text-[11px] text-fg"
          >
            {COPY_FORMATS.map((f) => (
              <option key={f} value={f}>
                {t(COPY_LABEL[f])}
              </option>
            ))}
          </select>
        </label>
      </div>
      {settings.features.fieldIdsOverlay && (
        <Switch
          label={t('record.showIdsOnPage')}
          checked={settings.showFieldIdsOnPage}
          onCheckedChange={(checked) => void saveSettings({ showFieldIdsOnPage: checked })}
        />
      )}

      {state.status === 'loading' && (
        <p className="py-6 text-center text-xs text-fg-muted">{t('app.loading')}</p>
      )}
      {state.status === 'error' && (
        <ErrorPanel error={state.error} onRetry={() => state.reload(true)} />
      )}
      {state.status === 'success' && (
        <>
          <div className="flex items-center justify-between text-[11px] text-fg-muted">
            <span>
              {t('record.sources', {
                sources: state.data.sources.map((s) => t(`record.source.${s}`)).join(' + '),
              })}
            </span>
            <span>
              {t('record.count', { shown: fields.length, total: state.data.fields.length })}
            </span>
          </div>
          {state.data.warnings.map((w) => (
            <p key={w} className="rounded bg-warning/10 px-2 py-1 text-[11px] text-warning">
              {isMessageKey(w) ? t(w) : w}
            </p>
          ))}
          <section aria-label={t('record.bodyFields')}>
            <h2 className="mb-1 text-xs font-semibold text-fg">{t('record.bodyFields')}</h2>
            {fields.length === 0 ? (
              <p className="py-3 text-center text-xs text-fg-muted">{t('record.noMatches')}</p>
            ) : (
              <>
                {groups.onForm.length > 0 && (
                  <FieldTable fields={groups.onForm} onCopy={(id) => onCopy(id)} showValue />
                )}
                {groups.notOnForm.length > 0 && (
                  // Folded by default; opened while searching so matches stay visible.
                  <details
                    key={searching ? 'search' : 'browse'}
                    open={searching || groups.onForm.length === 0}
                    className="mt-2 rounded-md border border-line"
                  >
                    <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-fg">
                      {t('record.notOnForm', { count: groups.notOnForm.length })}{' '}
                      <span className="font-normal text-fg-muted">
                        · {t('record.notOnFormHint')}
                      </span>
                    </summary>
                    <FieldTable fields={groups.notOnForm} onCopy={(id) => onCopy(id)} showValue />
                  </details>
                )}
              </>
            )}
          </section>
          {state.data.sublists.length > 0 && (
            <section aria-label={t('record.sublists')}>
              <h2 className="mb-1 mt-2 text-xs font-semibold text-fg">{t('record.sublists')}</h2>
              {state.data.sublists.map((sublist) => {
                const subFields = filterFields(sublist.fields, { ...active, nonEmptyOnly: false });
                if (subFields.length === 0 && active.query) return null;
                return (
                  <details key={sublist.id} open className="mb-2 rounded-md border border-line">
                    <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-fg">
                      <span className="font-mono">{sublist.id}</span>{' '}
                      <span className="text-fg-muted">
                        · {t('record.sublistLines', { count: sublist.lineCount })}
                      </span>
                    </summary>
                    <FieldTable fields={subFields} onCopy={(id) => onCopy(id, sublist.id)} />
                  </details>
                );
              })}
            </section>
          )}
          <div>
            <Button variant="ghost" onClick={() => state.reload(true)}>
              {t('app.refresh')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FieldTable({
  fields,
  onCopy,
  showValue = false,
}: {
  fields: RecordFieldInfo[];
  onCopy: (fieldId: string) => void;
  showValue?: boolean;
}) {
  return (
    <table className="w-full table-fixed border-collapse text-[11px]">
      <thead>
        <tr className="border-b border-line text-left text-fg-muted">
          <th className="w-[28%] py-1 pr-1 font-medium">{t('record.col.label')}</th>
          <th className="w-[30%] py-1 pr-1 font-medium">{t('record.col.id')}</th>
          <th className="w-[14%] py-1 pr-1 font-medium">{t('record.col.type')}</th>
          {showValue && <th className="py-1 pr-1 font-medium">{t('record.col.value')}</th>}
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => (
          <tr
            key={f.id}
            className="border-b border-line/60 align-top hover:bg-muted/60"
            data-field-id={f.id}
          >
            <td className="py-1 pr-1 text-fg">
              <span className="break-words">{f.label ?? t('record.unknown')}</span>
              <span className="mt-0.5 flex flex-wrap gap-0.5">
                {f.mandatory && <Badge tone="danger">{t('record.flag.mandatory')}</Badge>}
                <Badge tone={f.custom ? 'custom' : 'neutral'}>
                  {t(f.custom ? 'record.flag.custom' : 'record.flag.standard')}
                </Badge>
                {f.disabled && <Badge>{t('record.flag.disabled')}</Badge>}
                {f.hidden && <Badge tone="warning">{t('record.flag.hidden')}</Badge>}
              </span>
            </td>
            <td className="py-1 pr-1">
              <button
                type="button"
                onClick={() => onCopy(f.id)}
                title={t('record.copyTitle', { value: f.id })}
                className="max-w-full break-all rounded px-0.5 text-left font-mono text-accent hover:bg-accent/10"
              >
                {f.id}
              </button>
            </td>
            <td className="py-1 pr-1 font-mono text-fg-muted">{f.type ?? t('record.unknown')}</td>
            {showValue && (
              <td className="py-1 pr-1 text-fg">
                <span
                  className="line-clamp-3 break-words whitespace-pre-line"
                  title={displayValue(f.value)}
                >
                  {displayValue(f.value)}
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
