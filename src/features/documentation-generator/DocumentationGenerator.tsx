import { useEffect, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import type { PageContext } from '../../netsuite/types';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { fieldClass } from '../../shared/ui/field';
import { Spinner } from '../../shared/ui/Spinner';
import { copyWithToast } from '../../shared/ui/clipboard';
import { downloadLocal } from '../../shared/ui/download';
import { CopyIcon, DownloadIcon } from '../../shared/ui/icons';
import { MarkdownView } from '../../shared/ui/MarkdownView';
import { useFeatures } from '../../shared/store';
import { ContextExport } from '../ai/export/ContextExport';
import { isRecordTypeId, loadRecordContext } from '../ai/export/contextModel';
import { asBuiltPreview } from './asBuilt';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: SuiteLensErrorShape }
  | { status: 'done'; preview: string };

type Preset = 'asBuilt' | 'agent';

/**
 * Docs tab: export presets for one record type. "As-built document" is the human draft;
 * "AI agent context" is the metadata-only Context Export (no AI call).
 */
export function DocumentationGenerator({
  adapter,
  context,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
}) {
  const features = useFeatures();
  const presets: Preset[] = [
    ...(features.documentationGenerator ? (['asBuilt'] as const) : []),
    ...(features.aiContextExport ? (['agent'] as const) : []),
  ];
  const [chosen, setPreset] = useState<Preset>('asBuilt');
  const preset = presets.includes(chosen) ? chosen : (presets[0] ?? 'asBuilt');
  return (
    <div className="flex flex-col">
      {presets.length > 1 && (
        <div
          role="radiogroup"
          aria-label={t('docs.preset')}
          className="flex gap-1 border-b border-line px-3 pt-3 pb-2"
        >
          {presets.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={preset === id}
              onClick={() => setPreset(id)}
              className={
                preset === id
                  ? 'rounded-full bg-selected px-3 py-0.5 text-xs font-medium text-accent'
                  : 'rounded-full px-3 py-0.5 text-xs font-medium text-fg-muted hover:bg-muted'
              }
            >
              {t(`docs.preset.${id}`)}
            </button>
          ))}
        </div>
      )}
      {preset === 'agent' ? (
        <ContextExport adapter={adapter} context={context} embedded={presets.length > 1} />
      ) : (
        <AsBuiltDocument adapter={adapter} context={context} />
      )}
    </div>
  );
}

function AsBuiltDocument({ adapter, context }: { adapter: NetSuiteAdapter; context: PageContext }) {
  const [recordType, setRecordType] = useState(context.recordType ?? '');
  const scope = JSON.stringify([
    adapter.kind,
    context.accountId,
    context.url,
    context.recordType,
    context.recordId,
  ]);
  const [owned, setOwned] = useState<{ scope: string; state: State }>({
    scope,
    state: { status: 'idle' },
  });
  const state = owned.scope === scope ? owned.state : { status: 'idle' as const };
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [adapter, scope]);
  const trimmed = recordType.trim();
  const valid = isRecordTypeId(trimmed);
  const reset = () => {
    controller.current?.abort();
    setOwned({ scope, state: { status: 'idle' } });
  };
  const generate = async () => {
    if (!valid) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setOwned({ scope, state: { status: 'loading' } });
    try {
      const model = await loadRecordContext(adapter, context, trimmed, { signal: abort.signal });
      if (!abort.signal.aborted)
        setOwned({ scope, state: { status: 'done', preview: asBuiltPreview(model) } });
    } catch (error) {
      if (!abort.signal.aborted)
        setOwned({ scope, state: { status: 'error', error: toSuiteLensError(error).toShape() } });
    }
  };
  return (
    <section className="flex flex-col gap-2 p-3" aria-labelledby="docs-title">
      <h2 id="docs-title" className="text-sm font-semibold">
        {t('docs.title')}
      </h2>
      <p className="text-xs text-fg-muted">{t('docs.intro')}</p>
      <label className="flex flex-col gap-1 text-xs font-semibold text-fg-muted">
        {t('ai.export.recordType')}
        <input
          className={`${fieldClass} w-full font-mono`}
          type="text"
          value={recordType}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={trimmed !== '' && !valid}
          aria-describedby="docs-type-hint"
          onChange={(event) => {
            reset();
            setRecordType(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void generate();
          }}
        />
      </label>
      <p id="docs-type-hint" className="text-xs text-fg-subtlest">
        {trimmed !== '' && !valid
          ? t('ai.export.invalidRecordType')
          : trimmed !== context.recordType
            ? t('ai.export.otherTypeNote', { recordType: trimmed })
            : t('ai.export.recordTypeHint')}
      </p>
      <div className="flex flex-wrap gap-1">
        <Button
          variant="primary"
          disabled={!valid || state.status === 'loading'}
          onClick={() => void generate()}
        >
          {t('docs.generate')}
        </Button>
        {state.status === 'loading' && <Button onClick={reset}>{t('ai.export.cancel')}</Button>}
      </div>
      {state.status === 'idle' && (
        <EmptyState title={t('docs.empty.title')} body={t('docs.empty.body')} />
      )}
      {state.status === 'loading' && <Spinner label={t('docs.loading')} />}
      {state.status === 'error' && (
        <ErrorPanel error={state.error} onRetry={() => void generate()} />
      )}
      {state.status === 'done' && (
        <>
          <div className="flex flex-wrap gap-1">
            <Button
              spacing="compact"
              onClick={() => void copyWithToast(state.preview, t('ai.export.copiedMarkdown'))}
            >
              <CopyIcon className="h-3.5 w-3.5" />
              {t('ai.export.copyMarkdown')}
            </Button>
            <Button
              spacing="compact"
              onClick={() =>
                downloadLocal(
                  state.preview,
                  `${trimmed}-as-built.md`,
                  'text/markdown;charset=utf-8',
                )
              }
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              {t('ai.export.downloadMarkdown')}
            </Button>
          </div>
          <MarkdownView
            source={state.preview}
            label={t('docs.preview')}
            toc
            className="rounded-lg border border-line bg-surface p-3"
          />
        </>
      )}
    </section>
  );
}
