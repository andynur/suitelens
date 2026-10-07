import { useEffect, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import type { AutomationResult, PageContext } from '../../netsuite/types';
import { t } from '../../shared/i18n';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { Spinner } from '../../shared/ui/Spinner';
import type { ImpactScanProgress } from './scan';
import { readScriptMetadata, summarizeScriptMetadata } from './loadScriptMetadata';

/** Caller keys this view by page/account/plan. Metadata never enters scan caches. */
export function ScriptMetadata({
  adapter,
  context,
  progress,
  disabled,
  auto = false,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
  progress: ImpactScanProgress;
  disabled: boolean;
  /** Read once when the scan completes (ADR 0051); the button reloads. */
  auto?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ adapter: NetSuiteAdapter; result: AutomationResult }>();
  const [error, setError] = useState<{ adapter: NetSuiteAdapter; value: SuiteLensErrorShape }>();
  const [reading, setReading] = useState<NetSuiteAdapter>();
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [adapter],
  );
  const result = loaded?.adapter === adapter ? loaded.result : undefined;
  const summary = result ? summarizeScriptMetadata(progress, result) : undefined;
  const lookup = async () => {
    if (disabled || !context.recordType || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setReading(adapter);
    setLoaded(undefined);
    setError(undefined);
    try {
      const result = await readScriptMetadata(adapter, context, abort.signal);
      if (!abort.signal.aborted) setLoaded({ adapter, result });
    } catch (err) {
      if (!abort.signal.aborted) setError({ adapter, value: toSuiteLensError(err).toShape() });
    } finally {
      if (controller.current === abort) controller.current = null;
      if (!abort.signal.aborted) setReading(undefined);
    }
  };
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!auto || disabled || !context.recordType || autoStarted.current) return;
    autoStarted.current = true;
    void lookup();
  });
  return (
    <section
      aria-label={t('impact.scriptMetadata')}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-xs"
    >
      <h3 className="font-semibold text-fg-muted">{t('impact.scriptMetadata')}</h3>
      <Button
        className="self-start"
        disabled={disabled || !context.recordType || reading === adapter}
        onClick={() => void lookup()}
      >
        {t(result ? 'impact.reloadScriptMetadata' : 'impact.loadScriptMetadata')}
      </Button>
      <p className="text-fg-subtlest">
        {context.recordType
          ? t('impact.scriptMetadataScope', { recordType: context.recordType })
          : t('impact.scriptMetadataRecordRequired')}
      </p>
      {reading === adapter && <Spinner label={t('impact.readingScriptMetadata')} />}
      {error?.adapter === adapter && (
        <ErrorPanel error={error.value} onRetry={() => void lookup()} />
      )}
      {result && summary && (
        <>
          <p>{t('impact.scriptActivityCounts', summary.counts)}</p>
          <p className="text-fg-subtlest">
            {t('impact.scriptMetadataAt', { time: new Date(result.fetchedAt).toLocaleString() })}
          </p>
          {!result.complete && <p className="text-warning">{t('impact.scriptMetadataPartial')}</p>}
          <p>{t('impact.scriptMetadataUnmatched', { count: summary.unmatched })}</p>
          <ul className="flex flex-col gap-2">
            {summary.records.map((script) => (
              <li key={script.id} className="wrap-anywhere">
                <span className="font-semibold">{script.name}</span>{' '}
                <Badge>{t(`impact.scriptActivity.${script.activity}`)}</Badge>
                <span className="block text-fg-subtlest">
                  {t('impact.scriptMetadataIdentity', {
                    id: script.id,
                    files: [...script.files].join(', '),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
