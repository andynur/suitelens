import type { SuiteLensErrorShape } from '../../netsuite/errors';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { fieldClass } from '../../shared/ui/field';
import { InfoTip } from '../../shared/ui/InfoTip';
import { Switch } from '../../shared/ui/Switch';

/**
 * Scan options (⚙). Shown before the first scan and folded into a one-line summary after it.
 * Every explanation sits behind an ⓘ next to its control instead of a paragraph.
 */
export function ScanOptions({
  folder,
  folderValid,
  onFolder,
  excludeLibraries,
  onExcludeLibraries,
  libraryNames,
  libraryNamesValid,
  onLibraryNames,
  cacheIndex,
  onCacheIndex,
  files,
  filesValid,
  onFiles,
  prefilled,
  pageSearch,
  busy,
  scanLabel,
}: {
  folder: string;
  folderValid: boolean;
  onFolder: (value: string) => void;
  excludeLibraries: boolean;
  onExcludeLibraries: (value: boolean) => void;
  libraryNames: string;
  libraryNamesValid: boolean;
  onLibraryNames: (value: string) => void;
  cacheIndex: boolean;
  onCacheIndex: (value: boolean) => void;
  files: string;
  filesValid: boolean;
  onFiles: (value: string) => void;
  prefilled: boolean;
  pageSearch: {
    onAdd: () => void;
    error?: SuiteLensErrorShape;
    plan?: { found: number; added: number; atLimit: boolean };
  };
  busy: boolean;
  scanLabel: string;
}) {
  return (
    <div
      id="impact-options"
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-2"
    >
      <div className="flex items-center gap-1">
        <label className="text-xs font-medium" htmlFor="impact-folder">
          {t('impact.folder')}
        </label>
        <InfoTip label={t('impact.folderAbout')}>{t('impact.folderHelp')}</InfoTip>
      </div>
      <input
        id="impact-folder"
        className={`${fieldClass} w-full font-mono`}
        value={folder}
        maxLength={21}
        inputMode="numeric"
        disabled={busy}
        aria-describedby="impact-folder-help"
        onChange={(event) => onFolder(event.target.value)}
      />
      <p id="impact-folder-help" className="sr-only">
        {t('impact.folderHelp')}
      </p>
      {!folderValid && <p className="text-xs text-warning">{t('impact.folderInvalid')}</p>}
      <Switch
        label={t('impact.excludeLibraries')}
        description={t('impact.excludeLibrariesHelp')}
        checked={excludeLibraries}
        disabled={busy}
        onCheckedChange={onExcludeLibraries}
      />
      {excludeLibraries && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <label className="text-xs" htmlFor="impact-library-names">
              {t('impact.libraryNames')}
            </label>
            <InfoTip label={t('impact.libraryNamesAbout')}>{t('impact.libraryNamesHelp')}</InfoTip>
          </div>
          <textarea
            id="impact-library-names"
            className={`${fieldClass} w-full font-mono`}
            value={libraryNames}
            rows={2}
            maxLength={26000}
            disabled={busy}
            onChange={(event) => onLibraryNames(event.target.value)}
          />
          {!libraryNamesValid && (
            <p className="text-xs text-warning">{t('impact.libraryNamesInvalid')}</p>
          )}
        </div>
      )}
      <Switch
        label={t('impact.cacheIndex')}
        description={t('impact.cacheIndexHelp')}
        checked={cacheIndex}
        disabled={busy}
        onCheckedChange={onCacheIndex}
      />
      <details open={!!files}>
        <summary className="cursor-pointer text-xs text-fg-muted">{t('impact.advanced')}</summary>
        <div className="mt-2 flex flex-col gap-2">
          {prefilled && <p className="text-xs text-fg-muted">{t('impact.prefilledHint')}</p>}
          <div className="flex items-center gap-1">
            <Button spacing="compact" disabled={busy} onClick={pageSearch.onAdd}>
              {t('impact.addPageSearches')}
            </Button>
            <InfoTip label={t('impact.pageSearchAbout')}>{t('impact.pageSearchScope')}</InfoTip>
          </div>
          {pageSearch.error && <ErrorPanel error={pageSearch.error} onRetry={pageSearch.onAdd} />}
          {pageSearch.plan && (
            <p className="text-xs text-fg-muted">
              {t('impact.pageSearchPlan', {
                found: pageSearch.plan.found,
                added: pageSearch.plan.added,
              })}
              {pageSearch.plan.atLimit && ` ${t('impact.pageSearchLimit')}`}
            </p>
          )}
          <div className="flex items-center gap-1">
            <label className="text-xs" htmlFor="impact-files">
              {t('impact.files')}
            </label>
            <InfoTip label={t('impact.filesAbout')}>{t('impact.help')}</InfoTip>
          </div>
          <textarea
            id="impact-files"
            className={`${fieldClass} w-full font-mono`}
            value={files}
            rows={3}
            maxLength={20000}
            disabled={busy}
            aria-describedby="impact-help"
            onChange={(event) => onFiles(event.target.value)}
          />
          <p id="impact-help" className="sr-only">
            {t('impact.help')}
          </p>
          {!filesValid && files && (
            <p className="text-xs text-fg-muted">{t('impact.validation')}</p>
          )}
          <div>
            <Button type="submit" spacing="compact" disabled={busy || !filesValid}>
              {scanLabel}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
