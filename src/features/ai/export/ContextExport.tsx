import { useEffect, useMemo, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../../netsuite/errors';
import type { PageContext } from '../../../netsuite/types';
import { t } from '../../../shared/i18n';
import { Button } from '../../../shared/ui/Button';
import { copyWithToast } from '../../../shared/ui/clipboard';
import { downloadLocal } from '../../../shared/ui/download';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorPanel } from '../../../shared/ui/ErrorPanel';
import { fieldClass } from '../../../shared/ui/field';
import { Spinner } from '../../../shared/ui/Spinner';
import { CopyIcon, DownloadIcon } from '../../../shared/ui/icons';
import { Menu } from '../../../shared/ui/Menu';
import {
  agentSnippet,
  contextFilePath,
  isRecordTypeId,
  loadRecordContext,
  toJson,
  toMarkdown,
  type ContextStep,
  type RecordContextModel,
} from './contextModel';

type State =
  | { status: 'idle' }
  | { status: 'loading'; step?: ContextStep }
  | { status: 'error'; error: SuiteLensErrorShape }
  | { status: 'done'; model: RecordContextModel; markdown: string; json: string };
const IDLE: State = { status: 'idle' };

/** AI Context Export (F-5.13–F-5.17). Metadata only; no AI call. MCP exposure is v1.0. */
export function ContextExport({
  adapter,
  context,
  embedded = false,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
  /** Inside the Docs tab the preset switch names the section, so the heading is visual-only. */
  embedded?: boolean;
}) {
  const [recordType, setRecordType] = useState(context.recordType ?? '');
  const [owned, setOwned] = useState<{ accountId: string; state: State }>({
    accountId: context.accountId,
    state: IDLE,
  });
  // Per-account isolation: an export (or pending load) of another account is never shown.
  const state = owned.accountId === context.accountId ? owned.state : IDLE;
  const setState = (next: State) => setOwned({ accountId: context.accountId, state: next });
  const controller = useRef<AbortController | null>(null);
  const trimmed = recordType.trim();
  const valid = isRecordTypeId(trimmed);
  const otherType = valid && trimmed !== context.recordType;

  useEffect(() => () => controller.current?.abort(), [context.accountId]);

  const generate = async () => {
    if (!valid) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'loading' });
    try {
      const model = await loadRecordContext(adapter, context, trimmed, {
        signal: abort.signal,
        onStep: (step) => {
          if (!abort.signal.aborted) setState({ status: 'loading', step });
        },
      });
      if (abort.signal.aborted) return;
      setState({ status: 'done', model, markdown: toMarkdown(model), json: toJson(model) });
    } catch (err) {
      if (abort.signal.aborted) return;
      setState({ status: 'error', error: toSuiteLensError(err).toShape() });
    }
  };
  const cancel = () => {
    controller.current?.abort();
    setState({ status: 'idle' });
  };

  const summary = useMemo(() => {
    if (state.status !== 'done') return '';
    const m = state.model;
    return t('ai.export.summary', {
      fields: m.bodyFields.length,
      custom: m.bodyFields.filter((f) => f.custom).length,
      sublists: m.sublists.length,
      scripts: m.scripts.length,
      workflows: m.workflows.length,
      records: m.relatedCustomRecords.length,
    });
  }, [state]);

  return (
    <section className="flex flex-col gap-2 p-3" aria-labelledby="ai-export-title">
      <h2 id="ai-export-title" className={embedded ? 'sr-only' : 'text-sm font-semibold'}>
        {t('ai.export.title')}
      </h2>
      <p className="text-xs text-fg-muted">{t('ai.export.intro')}</p>
      <label className="flex flex-col gap-1 text-xs font-semibold text-fg-muted">
        {t('ai.export.recordType')}
        <input
          type="text"
          className={`${fieldClass} w-full font-mono`}
          value={recordType}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={trimmed !== '' && !valid}
          aria-describedby="ai-export-type-hint"
          onChange={(e) => setRecordType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void generate();
          }}
        />
      </label>
      <p id="ai-export-type-hint" className="text-xs text-fg-subtlest">
        {trimmed !== '' && !valid ? (
          <span className="text-danger">{t('ai.export.invalidRecordType')}</span>
        ) : otherType ? (
          t('ai.export.otherTypeNote', { recordType: trimmed })
        ) : (
          t('ai.export.recordTypeHint')
        )}
      </p>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="primary"
          disabled={!valid || state.status === 'loading'}
          onClick={() => void generate()}
        >
          {t('ai.export.generate')}
        </Button>
        {context.recordType && context.recordType !== trimmed && (
          <Button onClick={() => setRecordType(context.recordType ?? '')}>
            {t('ai.export.useActive', { recordType: context.recordType })}
          </Button>
        )}
        {state.status === 'loading' && <Button onClick={cancel}>{t('ai.export.cancel')}</Button>}
      </div>

      {state.status === 'loading' && (
        <Spinner label={state.step ? t(`ai.export.step.${state.step}`) : t('app.loading')} />
      )}
      {state.status === 'error' && (
        <ErrorPanel error={state.error} onRetry={() => void generate()} />
      )}
      {state.status === 'idle' && (
        <EmptyState title={t('ai.export.empty.title')} body={t('ai.export.empty.body')} />
      )}
      {state.status === 'done' && (
        <>
          <p className="text-xs text-fg-subtlest" role="status">
            {summary}
          </p>
          <div className="flex flex-wrap gap-1">
            <Menu
              align="start"
              label={t('ai.export.copyMenu')}
              text={t('ai.export.copyMenu')}
              icon={<CopyIcon className="h-3.5 w-3.5" />}
              items={[
                {
                  label: t('ai.export.copyMarkdown'),
                  onSelect: () => void copyWithToast(state.markdown, t('ai.export.copiedMarkdown')),
                },
                {
                  label: t('ai.export.copyJson'),
                  onSelect: () => void copyWithToast(state.json, t('ai.export.copiedJson')),
                },
                {
                  label: t('ai.export.copySnippet'),
                  onSelect: () =>
                    void copyWithToast(
                      agentSnippet([state.model.recordType]),
                      t('ai.export.copiedSnippet'),
                    ),
                },
              ]}
            />
            <Menu
              align="start"
              label={t('ai.export.downloadMenu')}
              text={t('ai.export.downloadMenu')}
              icon={<DownloadIcon className="h-3.5 w-3.5" />}
              items={[
                {
                  label: t('ai.export.downloadMarkdown'),
                  onSelect: () =>
                    downloadLocal(
                      state.markdown,
                      `${state.model.recordType}.md`,
                      'text/markdown;charset=utf-8',
                    ),
                },
                {
                  label: t('ai.export.downloadJson'),
                  onSelect: () =>
                    downloadLocal(
                      state.json,
                      `${state.model.recordType}.json`,
                      'application/json;charset=utf-8',
                    ),
                },
              ]}
            />
          </div>
          <p className="text-xs text-fg-subtlest">
            {t('ai.export.savePath', { path: contextFilePath(state.model.recordType) })}
          </p>
          <pre
            aria-label={t('ai.export.preview')}
            tabIndex={0}
            className="rounded-lg border border-line bg-surface p-3 font-mono text-xs whitespace-pre-wrap wrap-anywhere text-fg"
          >
            {state.markdown}
          </pre>
        </>
      )}
    </section>
  );
}
