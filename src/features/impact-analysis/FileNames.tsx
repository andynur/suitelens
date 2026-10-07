import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { Spinner } from '../../shared/ui/Spinner';
import { InfoTip } from '../../shared/ui/InfoTip';
import { readFileNames } from './loadFileNames';
import type { ImpactScanPlan } from './scan';

/**
 * The caller keys this view by account/page/plan. Labels are never written into checkpoints.
 * With `auto`, names are read once when the scan completes (ADR 0051); "Reload" reads again.
 */
export function FileNames({
  adapter,
  plan,
  pageUrl,
  names,
  disabled,
  auto = false,
  children,
}: {
  adapter: NetSuiteAdapter;
  plan: ImpactScanPlan;
  pageUrl: string;
  names: ReadonlyMap<string, string>;
  disabled: boolean;
  auto?: boolean;
  children: (names: ReadonlyMap<string, string>) => ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ adapter: NetSuiteAdapter; names: Map<string, string> }>();
  const [reading, setReading] = useState<NetSuiteAdapter>();
  const [error, setError] = useState<{ adapter: NetSuiteAdapter; value: SuiteLensErrorShape }>();
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [adapter],
  );
  const resolved = new Map(names);
  if (loaded?.adapter === adapter) for (const [id, name] of loaded.names) resolved.set(id, name);
  const lookup = async () => {
    if (disabled || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setReading(adapter);
    setError(undefined);
    setLoaded(undefined);
    try {
      const result = await readFileNames(adapter, plan, pageUrl, abort.signal);
      if (!abort.signal.aborted) setLoaded({ adapter, names: result });
    } catch (err) {
      if (!abort.signal.aborted) setError({ adapter, value: toSuiteLensError(err).toShape() });
    } finally {
      if (controller.current === abort) controller.current = null;
      if (!abort.signal.aborted) setReading(undefined);
    }
  };
  // Read once per mounted plan when allowed; the caller remounts on a new plan or page.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!auto || disabled || autoStarted.current) return;
    autoStarted.current = true;
    void lookup();
  });
  return (
    <>
      <div className="flex flex-wrap items-center gap-1 text-xs text-fg-subtlest">
        {reading === adapter ? (
          <Spinner label={t('impact.loadingFileNames')} />
        ) : (
          loaded?.adapter === adapter && (
            <span>
              {t('impact.fileNamesLoaded', { found: loaded.names.size, total: plan.files.length })}
            </span>
          )
        )}
        <InfoTip label={t('impact.fileNamesAbout')}>{t('impact.fileNamesScope')}</InfoTip>
        <Button
          variant="ghost"
          spacing="compact"
          disabled={disabled || reading === adapter}
          onClick={() => void lookup()}
        >
          {t(loaded?.adapter === adapter ? 'impact.reloadFileNames' : 'impact.loadFileNames')}
        </Button>
      </div>
      {error?.adapter === adapter && (
        <ErrorPanel error={error.value} onRetry={() => void lookup()} />
      )}
      {children(resolved)}
    </>
  );
}
