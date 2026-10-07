import { t } from '../../shared/i18n';
import { formatRelativeTime } from '../../shared/time';
import { IconButton } from '../../shared/ui/Button';
import { RefreshIcon } from '../../shared/ui/icons';
import { InfoTip } from '../../shared/ui/InfoTip';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import type { ImpactScanProgress } from './scan';

/**
 * One line for the whole scan: honest counts, the coverage caveat in an ⓘ, the time, and
 * "Rescan from source". Status that used to repeat on every file card is listed here once.
 */
export function ResultsHeader({
  progress,
  now,
  busy,
  onRescan,
}: {
  progress: ImpactScanProgress;
  now: number;
  busy: boolean;
  onRescan: () => void;
}) {
  const hits =
    progress.results.reduce((sum, file) => sum + file.hits.length, 0) +
    progress.searchResults.reduce((sum, search) => sum + search.hits.length, 0);
  const failed =
    progress.results.filter((file) => file.status === 'not-checked').length +
    progress.searchResults.filter((search) => search.status === 'not-checked').length;
  const done = progress.results.length + progress.searchResults.length;
  const total = progress.plan.files.length + (progress.plan.searches?.length ?? 0);
  const scripts = progress.results.filter((file) => file.source === 'script');
  const notes = [
    progress.results.some((file) => file.fromIndex) && t('impact.fromIndex'),
    progress.results.some((file) => file.status === 'checked' && !file.sourceUrl) &&
      t('impact.sourceLinkUnavailable'),
    scripts.some((file) => file.hits.some((hit) => !hit.excerpt)) && t('impact.excerptUnavailable'),
  ].filter((note): note is string => !!note);
  return (
    <div className="flex flex-col gap-1">
      <div role="status" className="flex flex-wrap items-center gap-1 text-xs">
        <span className="font-semibold text-fg">{t('impact.summary', { hits, failed })}</span>
        <InfoTip label={t('impact.coverageAbout')}>{t('impact.coverage')}</InfoTip>
        <span className="ml-auto flex items-center gap-1 text-fg-subtlest">
          <span className={progress.status === 'cancelled' ? 'text-fg-muted' : 'sr-only'}>
            {t(`impact.${progress.status}`)}
          </span>
          <span>{t('impact.progress', { done, total })}</span>
          <span aria-hidden>·</span>
          <span title={new Date(progress.updatedAt).toLocaleString()}>
            {t('impact.updated', { time: formatRelativeTime(progress.updatedAt, now) })}
          </span>
          <IconButton
            label={t('impact.refresh')}
            icon={<RefreshIcon className="h-3.5 w-3.5" />}
            disabled={busy}
            onClick={onRescan}
          />
        </span>
      </div>
      {!progress.cacheAvailable && (
        <SectionMessage appearance="warning">{t('impact.cacheUnavailable')}</SectionMessage>
      )}
      {notes.length > 0 && (
        <ul className="flex flex-col text-xs text-fg-subtlest">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {scripts.some((file) => file.hits.some((hit) => hit.excerpt)) && (
        <p className="text-xs text-fg-subtlest">{t('impact.excerptPrivacy')}</p>
      )}
    </div>
  );
}
