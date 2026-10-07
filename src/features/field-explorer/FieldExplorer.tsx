import { SearchHighlight } from '../../shared/ui/SearchHighlight';
import { fieldConsoleSql, recordConsoleSql } from '../../netsuite/queries/consoleExamples';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError } from '../../netsuite/errors';
import type { PageContext, RecordFieldInfo, RecordFieldsResult } from '../../netsuite/types';
import { useAsync } from '../../shared/hooks/useAsync';
import { isMessageKey, t } from '../../shared/i18n';
import { useAppStore, useFeatures } from '../../shared/store';
import { Badge } from '../../shared/ui/Badge';
import { IconButton } from '../../shared/ui/Button';
import { copyWithToast } from '../../shared/ui/clipboard';
import { cn } from '../../shared/ui/cn';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { fieldClass } from '../../shared/ui/field';
import { Menu } from '../../shared/ui/Menu';
import { ToggleChip } from '../../shared/ui/ToggleChip';
import {
  CheckIcon,
  ConsoleIcon,
  CopyIcon,
  InfoIcon,
  LocateIcon,
  RefreshIcon,
  SearchIcon,
  TagIcon,
} from '../../shared/ui/icons';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { Skeleton } from '../../shared/ui/Skeleton';
import { COPY_FORMATS, formatFieldCopy, type CopyFormat } from './copy';
import { formatFieldValue, partitionByForm } from './display';
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
  onWhereUsed,
}: {
  onWhereUsed?: (identifier: string) => void;
  adapter: NetSuiteAdapter;
  context: PageContext & { recordType: string };
}) {
  const settings = useAppStore((s) => s.settings);
  const features = useFeatures();
  const saveSettings = useAppStore((s) => s.saveSettings);
  const toast = useAppStore((s) => s.toast);
  const [localFilters, setFilters] = useState<FieldFilters>(EMPTY_FILTERS);
  // "Hide empty" is remembered in settings; the other filters reset per record.
  const filters = { ...localFilters, nonEmptyOnly: settings.hideEmptyFields };
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('id');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
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

  // Share what was read with the header and summary strip (no extra request, panel memory only).
  const loaded = state.status === 'success' ? state.data : undefined;
  useEffect(() => {
    if (!loaded) return;
    const title = loaded.fields.find((f) =>
      ['tranid', 'entityid', 'name', 'itemid'].includes(f.id),
    )?.value;
    useAppStore.getState().setRecordSummary({
      accountId: context.accountId,
      url: context.url,
      fieldCount: loaded.fields.length,
      ...(title ? { title } : {}),
    });
  }, [loaded, context.accountId, context.url]);

  // A command-bar field search fills the search box once.
  useEffect(() => {
    const take = (search: { accountId: string; query: string } | undefined) => {
      if (!search || search.accountId !== context.accountId) return;
      setFilters((previous) => ({ ...previous, query: search.query }));
      useAppStore.getState().setFieldSearch(undefined);
    };
    queueMicrotask(() => take(useAppStore.getState().fieldSearch));
    return useAppStore.subscribe((state) => take(state.fieldSearch));
  }, [context.accountId]);

  // The check mark after a copy fades back to the copy icon.
  useEffect(() => {
    if (!copiedKey) return;
    const id = setTimeout(() => setCopiedKey(null), 1500);
    return () => clearTimeout(id);
  }, [copiedKey]);

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
  const showIds = settings.showFieldIdsOnPage;

  const onCopy = (fieldId: string, sublistId?: string) =>
    void copyWithToast(formatFieldCopy(fieldId, copyFormat, sublistId)).then((ok) => {
      if (ok) setCopiedKey(`${sublistId ?? ''}:${fieldId}`);
    });

  const onLocate = (fieldId: string) =>
    void adapter
      .highlightField(fieldId)
      .catch(() => false)
      .then((found) => {
        if (!found) toast(t('record.locate.notFound', { fieldId }));
      });

  const consoleSql = features.suiteqlConsole ? recordConsoleSql(context) : undefined;
  const openInConsole = (sql: string) => {
    useAppStore.getState().setConsoleDraft({ accountId: context.accountId, sql });
    useAppStore.getState().setActiveTab('console');
  };
  const queryField = consoleSql
    ? (fieldId: string) => {
        const sql = fieldConsoleSql(context, fieldId);
        return sql ? () => openInConsole(sql) : undefined;
      }
    : undefined;

  // Section headers stick under the toolbar, whose height changes with the panel width.
  const root = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = toolbar.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() =>
      root.current?.style.setProperty('--record-toolbar-h', `${bar.offsetHeight}px`),
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const sources =
    state.status === 'success'
      ? t('record.sources', {
          sources: state.data.sources.map((s) => t(`record.source.${s}`)).join(' + '),
        })
      : '';

  return (
    <div ref={root} className="flex flex-col">
      <div
        ref={toolbar}
        className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-canvas p-3"
      >
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={filters.query}
            onChange={(e) => setFilters({ ...localFilters, query: e.target.value })}
            placeholder={t('record.search')}
            aria-label={t('record.search')}
            className={cn(fieldClass, 'min-w-0 flex-1')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_TOGGLES.map(([name, labelKey]) => (
            <ToggleChip
              key={name}
              pressed={filters[name]}
              onPressedChange={(pressed) =>
                name === 'nonEmptyOnly'
                  ? void saveSettings({ hideEmptyFields: pressed })
                  : setFilters({ ...localFilters, [name]: pressed })
              }
            >
              {t(labelKey)}
            </ToggleChip>
          ))}
          {features.fieldIdsOverlay && (
            <ToggleChip
              role="switch"
              aria-checked={showIds}
              aria-label={t('record.showIdsOnPage')}
              title={t('record.showIdsOnPage')}
              pressed={showIds}
              onPressedChange={(pressed) => void saveSettings({ showFieldIdsOnPage: pressed })}
            >
              <TagIcon className="h-3 w-3" />
              {t('record.idsOnPage')}
            </ToggleChip>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-fg-subtlest">
            {state.status === 'success' && (
              <>
                <span>
                  {t('record.count', { shown: fields.length, total: state.data.fields.length })}
                </span>
                <span role="img" aria-label={sources} title={sources}>
                  <InfoIcon className="h-3.5 w-3.5" />
                </span>
              </>
            )}
            <IconButton
              label={t('app.refresh')}
              icon={<RefreshIcon className="h-3.5 w-3.5" />}
              disabled={state.status === 'loading'}
              onClick={() => state.reload(true)}
            />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {state.status === 'loading' && <Skeleton label={t('app.loading')} count={8} />}
        {state.status === 'error' && (
          <ErrorPanel error={state.error} onRetry={() => state.reload(true)} />
        )}
        {state.status === 'success' && (
          <>
            {state.data.warnings.map((w) => (
              <SectionMessage key={w} appearance="warning">
                {isMessageKey(w) ? t(w) : w}
              </SectionMessage>
            ))}
            <section aria-label={t('record.bodyFields')}>
              <div className={cn(stickyHeader, 'mb-1 flex items-center gap-2 py-1')}>
                <h2 className="text-sm font-semibold text-fg">{t('record.bodyFields')}</h2>
                <Menu
                  className="ml-auto"
                  label={t('record.actions')}
                  items={[
                    ...COPY_FORMATS.map((format) => ({
                      label: t('record.copyAsItem', { format: t(COPY_LABEL[format]) }),
                      icon:
                        copyFormat === format ? (
                          <CheckIcon className="h-3.5 w-3.5" />
                        ) : (
                          <span className="inline-block h-3.5 w-3.5" />
                        ),
                      onSelect: () => setCopyFormat(format),
                    })),
                    ...(consoleSql
                      ? [
                          {
                            label: t('console.openRecord'),
                            description: t('console.openRecord.title'),
                            icon: <ConsoleIcon className="h-3.5 w-3.5" />,
                            onSelect: () => openInConsole(consoleSql),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
              {fields.length === 0 ? (
                <p className="py-3 text-center text-xs text-fg-muted">{t('record.noMatches')}</p>
              ) : (
                <>
                  {groups.onForm.length > 0 && (
                    <FieldTable
                      onWhereUsed={onWhereUsed}
                      queryField={queryField}
                      query={active.query}
                      fields={groups.onForm}
                      copiedKey={copiedKey}
                      onCopy={(id) => onCopy(id)}
                      onLocate={onLocate}
                      showValue
                    />
                  )}
                  {groups.notOnForm.length > 0 && (
                    // Folded by default; opened while searching so matches stay visible.
                    <details
                      key={searching ? 'search' : 'browse'}
                      open={searching || groups.onForm.length === 0}
                      className="mt-2 rounded-lg border border-line bg-surface"
                    >
                      <summary className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-medium text-fg hover:bg-muted">
                        {t('record.notOnForm', { count: groups.notOnForm.length })}{' '}
                        <span className="font-normal text-fg-muted">
                          · {t('record.notOnFormHint')}
                        </span>
                      </summary>
                      <div className="px-2 pb-1">
                        <FieldTable
                          onWhereUsed={onWhereUsed}
                          queryField={queryField}
                          query={active.query}
                          fields={groups.notOnForm}
                          copiedKey={copiedKey}
                          onCopy={(id) => onCopy(id)}
                          showValue
                        />
                      </div>
                    </details>
                  )}
                </>
              )}
            </section>
            {state.data.sublists.length > 0 && (
              <section aria-label={t('record.sublists')}>
                <h2 className={cn(stickyHeader, 'mb-1 mt-2 py-1 text-sm font-semibold text-fg')}>
                  {t('record.sublists')}
                </h2>
                {state.data.sublists.map((sublist) => {
                  const subFields = filterFields(sublist.fields, {
                    ...active,
                    nonEmptyOnly: false,
                  });
                  if (subFields.length === 0 && active.query) return null;
                  return (
                    <details
                      key={sublist.id}
                      open
                      className="mb-2 rounded-lg border border-line bg-surface"
                    >
                      <summary
                        className={cn(
                          stickyHeader,
                          'cursor-pointer rounded-lg bg-surface px-2 py-1.5 text-xs font-medium text-fg hover:bg-muted',
                        )}
                      >
                        <span className="font-mono">{sublist.id}</span>{' '}
                        <span className="text-fg-muted">
                          · {t('record.sublistLines', { count: sublist.lineCount })}
                        </span>
                      </summary>
                      <div className="px-2 pb-1">
                        <FieldTable
                          onWhereUsed={onWhereUsed}
                          query={active.query}
                          fields={subFields}
                          copiedKey={copiedKey}
                          sublistId={sublist.id}
                          onCopy={(id) => onCopy(id, sublist.id)}
                        />
                      </div>
                    </details>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const stickyHeader = 'sticky top-[var(--record-toolbar-h,0px)] z-[5] bg-canvas';

function FieldTable({
  query,
  fields,
  copiedKey,
  sublistId,
  onCopy,
  onLocate,
  onWhereUsed,
  queryField,
  showValue = false,
}: {
  query: string;
  fields: RecordFieldInfo[];
  copiedKey: string | null;
  sublistId?: string;
  onCopy: (fieldId: string) => void;
  onLocate?: (fieldId: string) => void;
  onWhereUsed?: (identifier: string) => void;
  /** Opens a one-field SuiteQL draft; undefined when the field has no verified column. */
  queryField?: (fieldId: string) => (() => void) | undefined;
  showValue?: boolean;
}) {
  // One cell per row holding a grid: in a narrow panel the value stacks under the label, from
  // 480px it sits in its own column. Row actions stay at the end of the field block.
  return (
    <table className="@container w-full table-fixed border-collapse text-xs">
      <thead className="sr-only">
        <tr>
          <th>
            {showValue
              ? `${t('record.col.field')} · ${t('record.col.value')}`
              : t('record.col.field')}
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => {
          const copied = copiedKey === `${sublistId ?? ''}:${f.id}`;
          const label = f.label ?? t('record.unknown');
          const value = formatFieldValue(f);
          const onQuery = queryField?.(f.id);
          return (
            <tr
              key={f.id}
              className="group border-b border-line align-top hover:bg-muted"
              data-field-id={f.id}
            >
              <td
                className={cn(
                  'py-1.5',
                  showValue && 'grid grid-cols-1 gap-x-2 gap-y-0.5 @[480px]:grid-cols-[3fr_2fr]',
                )}
              >
                <div className="flex min-w-0 items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1 text-fg">
                      <span className="break-words">
                        <SearchHighlight text={label} query={query} />
                      </span>
                      {f.mandatory && <Badge tone="danger">{t('record.flag.mandatory')}</Badge>}
                      {f.disabled && <Badge>{t('record.flag.disabled')}</Badge>}
                      {f.hidden && <Badge tone="warning">{t('record.flag.hidden')}</Badge>}
                    </div>
                    <div className="flex min-w-0 items-start gap-1">
                      <button
                        type="button"
                        onClick={() => onCopy(f.id)}
                        title={t('record.copyTitle', { value: f.id })}
                        className="-ml-0.5 inline-flex min-w-0 items-start gap-1 rounded-xs px-0.5 text-left font-mono text-accent hover:bg-selected"
                      >
                        <span className="min-w-0 wrap-anywhere">
                          <SearchHighlight text={f.id} query={query} breakIds />
                        </span>
                        {copied ? (
                          <CheckIcon className="mt-px h-3.5 w-3.5 text-success" />
                        ) : (
                          <CopyIcon className="mt-px hidden h-3.5 w-3.5 group-hover:block group-focus-within:block" />
                        )}
                      </button>
                      {f.type && (
                        <span className="shrink-0 font-mono text-fg-subtlest" title={f.type}>
                          · {f.type}
                        </span>
                      )}
                    </div>
                  </div>
                  {(onWhereUsed || onLocate || onQuery) && (
                    <span className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      {onWhereUsed && (
                        <IconButton
                          label={t('impact.whereUsedFor', { identifier: f.id })}
                          icon={<SearchIcon className="h-3.5 w-3.5" />}
                          onClick={() => onWhereUsed(f.id)}
                        />
                      )}
                      {onQuery && (
                        <IconButton
                          label={t('record.queryField', { id: f.id })}
                          icon={<ConsoleIcon className="h-3.5 w-3.5" />}
                          onClick={onQuery}
                        />
                      )}
                      {onLocate && (
                        <IconButton
                          label={t('record.locate', { label })}
                          icon={<LocateIcon className="h-3.5 w-3.5" />}
                          onClick={() => onLocate(f.id)}
                        />
                      )}
                    </span>
                  )}
                </div>
                {showValue && (
                  <div className="min-w-0 text-fg">
                    {value ? (
                      <span className="line-clamp-3 break-words whitespace-pre-line" title={value}>
                        {value}
                      </span>
                    ) : (
                      <span className="text-fg-subtlest">{t('record.emptyValue')}</span>
                    )}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
