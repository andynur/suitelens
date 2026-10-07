import { t } from '../../shared/i18n';
import type { ImpactScanProgress } from './scan';
import { summarizeImpact } from './summary';

export function ReferenceSummary({ progress }: { progress: ImpactScanProgress }) {
  const { sources, visibility } = summarizeImpact(progress);
  return (
    <section
      aria-label={t('impact.referenceSummary')}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-xs"
    >
      <h3 className="font-semibold text-fg-muted">{t('impact.referenceSummary')}</h3>
      <p className="text-fg-muted">{t('impact.summaryScope')}</p>
      <table className="w-full table-fixed text-xs">
        <caption className="sr-only">{t('impact.referenceSummary')}</caption>
        <thead>
          <tr className="border-b border-line text-left font-semibold text-fg-muted">
            <th scope="col" className="w-1/2 py-1">
              {t('impact.summarySource')}
            </th>
            <th scope="col" className="w-1/4 py-1 text-right">
              {t('impact.summaryObjects')}
            </th>
            <th scope="col" className="w-1/4 py-1 text-right">
              {t('impact.summaryReferences')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.source} className="border-b border-line hover:bg-muted">
              <th scope="row" className="py-2 pr-1 text-left font-medium wrap-anywhere">
                {t(`impact.${source.source}`)}
                <span className="block font-normal text-fg-subtlest">
                  {source.planned
                    ? t('impact.summaryChecked', {
                        checked: source.checked,
                        planned: source.planned,
                      })
                    : t('impact.summaryNotIncluded')}
                </span>
                {source.notChecked > 0 && (
                  <span className="block font-normal text-warning">
                    {t('impact.summaryNotChecked', { count: source.notChecked })}
                  </span>
                )}
                {source.pending > 0 && (
                  <span className="block font-normal text-fg-muted">
                    {t('impact.summaryPending', { count: source.pending })}
                  </span>
                )}
              </th>
              <td className="py-2 text-right align-top">
                {source.planned ? source.objectsWithReferences : t('impact.summaryUnknown')}
              </td>
              <td className="py-2 text-right align-top">
                {source.planned ? source.references : t('impact.summaryUnknown')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {progress.plan.searches?.length ? (
        <>
          <p>{t('impact.summaryVisibility', visibility)}</p>
          {visibility.public > 0 && (
            <p>{t('impact.publicSearches', { count: visibility.public })}</p>
          )}
        </>
      ) : (
        <p className="text-fg-muted">{t('impact.summarySearchesNotChecked')}</p>
      )}
      <p className="text-fg-muted">{t('impact.unknownRisk')}</p>
    </section>
  );
}
