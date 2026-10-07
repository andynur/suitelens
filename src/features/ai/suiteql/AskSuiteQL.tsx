import { useEffect, useId, useState } from 'react';
import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import type { PageContext } from '../../../netsuite/types';
import { t } from '../../../shared/i18n';
import { getConsoleLibraryStorage } from '../../../shared/storage/consoleLibrary';
import { useAppStore } from '../../../shared/store';
import { Button } from '../../../shared/ui/Button';
import { fieldClass } from '../../../shared/ui/field';
import { SectionMessage } from '../../../shared/ui/SectionMessage';
import { Spinner } from '../../../shared/ui/Spinner';
import { AiResponse } from '../guard/AiResponse';
import {
  BUILTIN_SCHEMA,
  buildSchemaSummary,
  buildSuiteqlRequest,
  formatSchemaTable,
  schemaHeader,
  type SchemaSource,
  type SchemaTable,
} from '../prompts/suiteql';
import type { PayloadItem } from '../types';
import { useAiKeyStatus } from '../useAiKeyStatus';
import { useAiRequest } from '../useAiRequest';
import { isSqlLang, validateSuiteQL, type SqlIssue } from './validate';

type IndexState =
  { status: 'loading' } | { status: 'ready'; tables: SchemaTable[] } | { status: 'failed' };

/** Natural language → SuiteQL (F-5.5–F-5.7). Never runs the query; it opens in SuiteQL. */
export function AskSuiteQL({
  adapter,
  context,
  setupShown = false,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
  /** The parent already shows the setup card; show a muted line instead of a second one. */
  setupShown?: boolean;
}) {
  const keyStatus = useAiKeyStatus();
  const fixture = adapter.kind === 'fixture';
  const accountId = context.accountId;
  // Loaded index per account; a result for another account counts as still loading.
  const [loaded, setLoaded] = useState<{ accountId: string; state: IndexState }>();
  const index: IndexState = loaded?.accountId === accountId ? loaded.state : { status: 'loading' };
  const [question, setQuestion] = useState('');
  const run = useAiRequest(buildSuiteqlRequest);
  const fieldId = useId();

  useEffect(() => {
    let active = true;
    getConsoleLibraryStorage()
      .load(accountId)
      .then((library) => {
        if (active)
          setLoaded({
            accountId,
            state: { status: 'ready', tables: library.metadata?.tables ?? [] },
          });
      })
      .catch(() => {
        if (active) setLoaded({ accountId, state: { status: 'failed' } });
      });
    return () => {
      active = false;
    };
  }, [accountId]);

  const indexed = index.status === 'ready' ? index.tables : [];
  const source: SchemaSource = indexed.length ? 'index' : 'builtin';
  const schema = source === 'index' ? indexed : BUILTIN_SCHEMA;
  const busy = run.state.status === 'preview' || run.state.status === 'streaming';

  const ask = () => {
    const text = question.trim();
    if (!text) return;
    const summary = buildSchemaSummary(schema, text);
    const items: PayloadItem[] = [
      {
        id: 'question',
        kind: 'question',
        label: t('ai.suiteql.item.question'),
        content: text,
        required: true,
      },
      {
        id: 'schema-notes',
        kind: 'schema',
        label: t('ai.suiteql.item.notes'),
        content: schemaHeader(source),
      },
      ...summary.tables.map((table) => ({
        id: `schema:${table.name}`,
        kind: 'schema' as const,
        label: t(source === 'index' ? 'ai.suiteql.item.schema' : 'ai.suiteql.item.builtin', {
          table: table.name,
          count: table.columns.length,
        }),
        content: formatSchemaTable(table),
      })),
    ];
    run.preview(items);
  };

  const openConsole = (sql?: string) => {
    const store = useAppStore.getState();
    if (sql) store.setConsoleDraft({ accountId, sql });
    store.setActiveTab('console');
    // The AI drawer covers the tabs; close it so the query is visible.
    store.setAiOpen(false);
  };

  const renderCode = (code: string, lang: string) => {
    if (!isSqlLang(lang) || !code.trim() || run.state.status !== 'done') return null;
    return <SqlCheck sql={code.trim()} schema={schema} source={source} onOpen={openConsole} />;
  };

  const openSettings = () => useAppStore.getState().openAiSetup();
  const gated = !fixture && keyStatus !== 'ready';

  return (
    <section aria-labelledby={`${fieldId}-title`} className="flex flex-col gap-2 p-3">
      <h2 id={`${fieldId}-title`} className="text-sm font-semibold text-fg">
        {t('ai.suiteql.title')}
      </h2>
      <p className="text-xs text-fg-muted">{t('ai.suiteql.intro')}</p>
      {gated ? (
        keyStatus === 'loading' ? (
          <Spinner label={t('app.loading')} />
        ) : setupShown ? (
          <p className="text-xs text-fg-subtlest">{t('ai.setupAbove')}</p>
        ) : (
          <SectionMessage
            appearance="information"
            title={keyStatus === 'none' ? t('ai.notConfigured.title') : undefined}
            actions={<Button onClick={openSettings}>{t('ai.openSettings')}</Button>}
          >
            {t(keyStatus === 'locked' ? 'ai.locked.body' : 'ai.notConfigured.body')}
          </SectionMessage>
        )
      ) : (
        <>
          {fixture && <p className="text-xs text-fg-subtlest">{t('ai.suiteql.fixtureMode')}</p>}
          {index.status === 'loading' ? (
            <Spinner label={t('app.loading')} />
          ) : index.status === 'failed' ? (
            <SectionMessage appearance="warning">{t('ai.suiteql.indexFailed')}</SectionMessage>
          ) : source === 'builtin' ? (
            <SectionMessage
              appearance="information"
              title={t('ai.suiteql.noIndex.title')}
              actions={
                <Button onClick={() => openConsole()}>{t('ai.suiteql.openConsoleIndex')}</Button>
              }
            >
              {t('ai.suiteql.noIndex.body')}
            </SectionMessage>
          ) : (
            <p className="text-xs text-fg-subtlest">
              {t('ai.suiteql.indexStatus', { count: indexed.length })}
            </p>
          )}
          <label htmlFor={fieldId} className="text-xs font-semibold text-fg-muted">
            {t('ai.suiteql.question')}
          </label>
          <textarea
            id={fieldId}
            rows={3}
            value={question}
            placeholder={t('ai.suiteql.placeholder')}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (!busy) ask();
              }
            }}
            className={`${fieldClass} w-full`}
          />
          <div>
            <Button
              variant="primary"
              disabled={!question.trim() || busy || index.status === 'loading'}
              onClick={ask}
            >
              {t('ai.suiteql.ask')}
            </Button>
          </div>
          <AiResponse run={run} title={t('ai.suiteql.previewTitle')} renderCode={renderCode} />
        </>
      )}
    </section>
  );
}

function issueText(issue: SqlIssue, sourceName: string) {
  switch (issue.kind) {
    case 'notSelect':
      return t('ai.suiteql.issue.notSelect');
    case 'multipleStatements':
      return t('ai.suiteql.issue.multipleStatements');
    case 'unknownTable':
      return t('ai.suiteql.issue.unknownTable', { table: issue.table, source: sourceName });
    case 'unknownAlias':
      return t('ai.suiteql.issue.unknownAlias', { alias: issue.alias, column: issue.column });
    case 'unknownColumn':
      return issue.table
        ? t('ai.suiteql.issue.unknownColumn', {
            table: issue.table,
            column: issue.column,
            source: sourceName,
          })
        : t('ai.suiteql.issue.unknownColumnAny', { column: issue.column, source: sourceName });
  }
}

/** Validation result (F-5.7) and the Open in SuiteQL action for one SQL block. */
function SqlCheck({
  sql,
  schema,
  source,
  onOpen,
}: {
  sql: string;
  schema: SchemaTable[];
  source: SchemaSource;
  onOpen(sql: string): void;
}) {
  const { issues } = validateSuiteQL(sql, schema);
  // The Console is read-only too, but never hand it something that is not a single SELECT.
  const openable = !issues.some(
    (issue) => issue.kind === 'notSelect' || issue.kind === 'multipleStatements',
  );
  const sourceName = t(
    source === 'index' ? 'ai.suiteql.source.index' : 'ai.suiteql.source.builtin',
  );
  return (
    <div className="flex flex-col gap-2">
      {issues.length ? (
        <SectionMessage appearance="warning" title={t('ai.suiteql.check.title')}>
          <ul className="list-disc pl-4">
            {issues.map((issue, i) => (
              <li key={i}>{issueText(issue, sourceName)}</li>
            ))}
          </ul>
          <p className="mt-1 text-fg-muted">{t('ai.suiteql.check.limits')}</p>
        </SectionMessage>
      ) : (
        <SectionMessage appearance="success" role="status">
          {t(source === 'index' ? 'ai.suiteql.check.ok.index' : 'ai.suiteql.check.ok.builtin')}
        </SectionMessage>
      )}
      {openable && (
        <div>
          <Button onClick={() => onOpen(sql)}>{t('ai.suiteql.openInConsole')}</Button>
        </div>
      )}
    </div>
  );
}
