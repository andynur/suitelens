import type { ReactNode } from 'react';
import { t } from '../../shared/i18n';
import { Badge } from '../../shared/ui/Badge';
import { DISCOVERY_LIMITS, type ScriptInventory } from './discover';
import { ReferenceSummary } from './ReferenceSummary';
import type { ImpactScanProgress } from './scan';

/**
 * Collapsible "Coverage" section below the results: what was and was not checked. Keeps the
 * full coverage warning, reference summary, discovery notes and skipped libraries.
 */
export function CoverageSection({
  progress,
  inventory,
  notChecked,
  children,
}: {
  progress: ImpactScanProgress;
  inventory?: ScriptInventory;
  notChecked: [string, number][];
  children?: ReactNode;
}) {
  return (
    <details className="rounded-lg border border-line bg-surface text-xs">
      <summary className="cursor-pointer px-2 py-1.5 font-semibold text-fg-muted hover:bg-muted">
        {t('impact.coverageTitle')}
      </summary>
      <div className="flex flex-col gap-2 px-2 pb-2">
        <p className="text-fg-muted">{t('impact.coverage')}</p>
        {inventory && <InventoryNotes inventory={inventory} />}
        {notChecked.length > 0 && (
          <div>
            <p className="text-fg-subtlest">{t('impact.fromMissCache')}</p>
            {notChecked.map(([text, count]) => (
              <p key={text} className="text-fg-muted">
                {t('impact.notCheckedGroup', { count, reason: text })}
              </p>
            ))}
          </div>
        )}
        <ReferenceSummary progress={progress} />
        {children}
      </div>
    </details>
  );
}

/** What discovery found or skipped (counts, truncation, bundle files, excluded libraries). */
export function InventoryNotes({ inventory }: { inventory: ScriptInventory }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <p className="text-fg-muted">
        {t('impact.discovered', { count: inventory.files.length })}
        {inventory.total > inventory.files.length &&
          ` ${t('impact.discoveredTruncated', { total: inventory.total, limit: DISCOVERY_LIMITS.files })}`}
        {inventory.folderLimited &&
          ` ${t('impact.folderLimited', { limit: DISCOVERY_LIMITS.folders })}`}
        {inventory.detailsUnavailable && ` ${t('impact.detailsUnavailable')}`}
        {inventory.bundleSkipped > 0 &&
          ` ${t('impact.bundleSkipped', { count: inventory.bundleSkipped })}`}
      </p>
      {!!inventory.excludedLibraries?.length && (
        <details>
          <summary className="cursor-pointer text-fg-muted">
            {t('impact.librariesSkipped', { count: inventory.excludedLibraries.length })}
          </summary>
          <p className="mt-2 text-fg-muted">{t('impact.librariesSkippedScope')}</p>
          <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {inventory.excludedLibraries.map((file) => (
              <li key={file.fileId} className="flex flex-wrap items-center gap-1">
                <span className="wrap-anywhere">{file.name}</span>
                <span className="text-fg-subtlest">{t('impact.file', { id: file.fileId })}</span>
                <Badge>{t('impact.librarySkipped')}</Badge>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
