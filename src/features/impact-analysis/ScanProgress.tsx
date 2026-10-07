import { t } from '../../shared/i18n';
import { Spinner } from '../../shared/ui/Spinner';
import type { ImpactScanProgress } from './scan';

/** Inline progress under the scan bar, only while work runs; the results header replaces it. */
export function ScanProgress({
  progress,
  discovering,
  planningSearches,
  running,
}: {
  progress?: ImpactScanProgress;
  discovering: boolean;
  planningSearches: boolean;
  running: boolean;
}) {
  if (discovering) return <Spinner label={t('impact.discovering')} />;
  if (planningSearches) return <Spinner label={t('impact.planningPageSearches')} />;
  if (!running) return null;
  if (!progress) return <Spinner label={t('impact.running')} />;
  const done = progress.results.length + progress.searchResults.length;
  const total = progress.plan.files.length + (progress.plan.searches?.length ?? 0);
  return (
    <div className="flex items-center gap-2 text-xs text-fg-muted">
      <progress
        className="h-1.5 min-w-0 flex-1"
        aria-label={t('impact.running')}
        value={done}
        max={total}
      />
      <span className="shrink-0">{t('impact.progress', { done, total })}</span>
    </div>
  );
}
