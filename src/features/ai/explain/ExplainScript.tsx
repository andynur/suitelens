import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import {
  SuiteLensError,
  toSuiteLensError,
  type SuiteLensErrorShape,
} from '../../../netsuite/errors';
import { ImpactSourceSchema } from '../../../netsuite/impact/source';
import type { AutomationItem, PageContext } from '../../../netsuite/types';
import { useAsync } from '../../../shared/hooks/useAsync';
import { t } from '../../../shared/i18n';
import { Button } from '../../../shared/ui/Button';
import { ErrorPanel } from '../../../shared/ui/ErrorPanel';
import { SectionMessage } from '../../../shared/ui/SectionMessage';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { Spinner } from '../../../shared/ui/Spinner';
import { fieldClass } from '../../../shared/ui/field';
import { AiResponse } from '../guard/AiResponse';
import {
  buildExplainScriptRequest,
  explainScriptQuestionItem,
  scriptMetadataItem,
  scriptSourceItem,
} from '../prompts/explainScript';
import type { PayloadItem } from '../types';
import { useAiRequest } from '../useAiRequest';
import { AiKeyNotice, useAiAvailability } from './AiKeyGate';

const MANUAL = 'manual';
const FILE_ID = /^[1-9][0-9]{0,19}$/;

type ReadState =
  | { status: 'idle'; truncated?: boolean }
  | { status: 'reading' }
  | { status: 'error'; error: SuiteLensErrorShape };

/** Script files of the record type's automations, one entry per file (all its deployments). */
function scriptFiles(items: AutomationItem[]) {
  const files = new Map<string, AutomationItem[]>();
  for (const item of items) {
    if (!item.scriptFileId || !FILE_ID.test(item.scriptFileId)) continue;
    const list = files.get(item.scriptFileId);
    if (list) list.push(item);
    else files.set(item.scriptFileId, [item]);
  }
  return files;
}

/**
 * Explain Script (F-5.8). The source is read only on an explicit click (never cached), then
 * shown in the preview with the script metadata; nothing is sent before the user confirms.
 */
export function ExplainScript({
  adapter,
  context,
  setupShown = false,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
  /** The parent already shows the setup card; show a muted line instead of a second one. */
  setupShown?: boolean;
}) {
  const availability = useAiAvailability(adapter);
  const run = useAiRequest(buildExplainScriptRequest);
  const ready = availability === 'ready';
  const recordType = context.recordType;
  const automations = useAsync(
    async () => (await adapter.getAutomations(recordType!)).items,
    ready && recordType ? `${context.accountId}:${recordType}` : null,
  );
  const [choice, setChoice] = useState('');
  const [manualId, setManualId] = useState('');
  const [read, setRead] = useState<ReadState>({ status: 'idle' });
  const readId = useRef(0);
  const ids = useId();

  // Results of a read that finishes after unmount are ignored.
  useEffect(
    () => () => {
      readId.current += 1;
    },
    [],
  );

  const files = useMemo(() => scriptFiles(automations.data ?? []), [automations.data]);
  const selected = choice || (files.keys().next().value as string | undefined) || MANUAL;
  const manual = selected === MANUAL;
  const fileId = manual ? manualId.trim() : selected;
  const validId = FILE_ID.test(fileId);
  const busy = read.status === 'reading' || run.state.status === 'streaming';

  const explain = useCallback(async () => {
    if (!FILE_ID.test(fileId)) return;
    const id = ++readId.current;
    setRead({ status: 'reading' });
    try {
      const source = ImpactSourceSchema.parse(
        await adapter.readImpactSource({ accountId: context.accountId, fileId, source: 'script' }),
      );
      if (source.accountId !== context.accountId || source.fileId !== fileId)
        throw new SuiteLensError('INVALID_RESPONSE', 'Source does not match the requested file.');
      if (id !== readId.current) return;
      const deployments = files.get(fileId) ?? [];
      const { item, truncated } = scriptSourceItem({
        fileId,
        fileName: deployments[0]?.scriptFileName,
        content: source.content,
      });
      setRead({ status: 'idle', truncated });
      run.preview(
        [
          explainScriptQuestionItem(),
          item,
          scriptMetadataItem(deployments, deployments.length ? recordType : undefined),
        ].filter((entry): entry is PayloadItem => !!entry),
      );
    } catch (error) {
      if (id === readId.current)
        setRead({ status: 'error', error: toSuiteLensError(error).toShape() });
    }
  }, [adapter, context.accountId, fileId, files, recordType, run]);

  return (
    <section className="flex flex-col gap-2 p-3" aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`} className="text-sm font-semibold">
        {t('ai.explain.script.title')}
      </h2>
      <p className="text-xs text-fg-subtlest">{t('ai.explain.script.desc')}</p>
      {setupShown ? (
        !ready &&
        availability !== 'loading' && (
          <p className="text-xs text-fg-subtlest">{t('ai.setupAbove')}</p>
        )
      ) : (
        <AiKeyNotice availability={availability} />
      )}
      {ready && (
        <>
          {!recordType ? (
            <p className="text-xs text-fg-muted">{t('ai.explain.script.noRecord')}</p>
          ) : automations.status === 'loading' ? (
            <Skeleton variant="rows" label={t('app.loading')} />
          ) : automations.status === 'error' ? (
            <ErrorPanel error={automations.error} onRetry={() => automations.reload(true)} />
          ) : !files.size ? (
            <p className="text-xs text-fg-muted">{t('ai.explain.script.noScripts')}</p>
          ) : (
            <label className="text-xs">
              {t('ai.explain.script.pick')}
              <select
                className={`${fieldClass} w-full`}
                value={selected}
                disabled={busy}
                onChange={(event) => setChoice(event.target.value)}
              >
                {[...files].map(([id, items]) => (
                  <option key={id} value={id}>
                    {t('ai.explain.script.option', {
                      name: items[0]!.name,
                      file: items[0]!.scriptFileName ?? id,
                    })}
                  </option>
                ))}
                <option value={MANUAL}>{t('ai.explain.script.other')}</option>
              </select>
            </label>
          )}
          {manual && (
            <label className="text-xs">
              {t('ai.explain.script.fileId')}
              <input
                inputMode="numeric"
                className={`${fieldClass} w-full`}
                value={manualId}
                disabled={busy}
                placeholder={t('ai.explain.script.fileIdHint')}
                onChange={(event) => setManualId(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && validId && !busy) void explain();
                }}
              />
            </label>
          )}
          <div>
            <Button variant="primary" disabled={!validId || busy} onClick={() => void explain()}>
              {t('ai.explain.script.explain')}
            </Button>
          </div>
          {read.status === 'reading' && <Spinner label={t('ai.explain.script.reading')} />}
          {read.status === 'error' && (
            <ErrorPanel error={read.error} onRetry={() => void explain()} />
          )}
          {read.status === 'idle' && read.truncated && (
            <SectionMessage appearance="warning">{t('ai.explain.script.truncated')}</SectionMessage>
          )}
        </>
      )}
      <AiResponse run={run} title={t('ai.explain.script.previewTitle')} />
    </section>
  );
}
