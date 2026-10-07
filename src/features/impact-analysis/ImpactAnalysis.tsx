import { parseLibraryFileNames } from './libraryExclusions';
import { PdfEditorScan } from './PdfEditorScan';
import { ScriptMetadata } from './ScriptMetadata';
import { planPageSearches } from './planPageSearches';
import { FileNames } from './FileNames';
import { useEffect, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import type { PageContext } from '../../netsuite/types';
import { t } from '../../shared/i18n';
import { createMetadataCache, type MetadataCache } from '../../shared/storage/cache';
import { getAccountSettings, updateAccountSettings } from '../../shared/storage/settings';
import { useNow } from '../../shared/time';
import { Badge } from '../../shared/ui/Badge';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { CoverageSection, InventoryNotes } from './CoverageSection';
import { ResultsHeader } from './ResultsHeader';
import { ScanBar } from './ScanBar';
import { ScanOptions } from './ScanOptions';
import { ScanProgress } from './ScanProgress';
import { useFieldSuggestions } from './useFieldSuggestions';
import { discoverScriptFiles, FolderIdPattern, type ScriptInventory } from './discover';
import {
  createImpactScanner,
  ImpactScanPlanSchema,
  type ImpactScanPlan,
  type ImpactScanProgress,
  type ImpactScanResult,
} from './scan';
import {
  countFileResults,
  FileResultFilters,
  FileResultSection,
  type FileFilter,
} from './FileResults';

function reasonText(reason: ImpactScanResult['reason'], failure?: ImpactScanResult['failure']) {
  if (failure) return t(`impact.failure.${failure}`);
  if (!reason) return '';
  if (reason === 'invalid-target' || reason === 'content-too-large' || reason === 'match-limit')
    return t('impact.limit');
  return t(`error.${reason}`);
}

/** One line per distinct cause, so a 200-file failure reads as one fact, not 200 cards. */
function notCheckedGroups(results: readonly ImpactScanResult[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const result of results) {
    if (result.status !== 'not-checked') continue;
    const text = reasonText(result.reason, result.failure);
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([, a], [, b]) => b - a);
}

/** Explicit linked-file workbench. Never treats partial coverage as a safe-change verdict. */
export function ImpactAnalysis({
  adapter,
  context,
  cache,
  initialTarget = '',
  initialFiles,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
  cache?: MetadataCache;
  initialTarget?: string;
  /** Source lines prefilled by a shortcut; never read until the user scans. */
  initialFiles?: string[];
}) {
  const [cacheStore] = useState(() => cache ?? createMetadataCache());
  const [scanner] = useState(() => createImpactScanner(adapter, cacheStore));
  const [cacheIndex, setCacheIndex] = useState<boolean>();
  const [savingIndex, setSavingIndex] = useState(false);
  const [target, setTarget] = useState(initialTarget);
  const [files, setFiles] = useState(initialFiles?.join('\n') ?? '');
  const [folder, setFolder] = useState('');
  const [excludeLibraries, setExcludeLibraries] = useState(false);
  const [libraryNames, setLibraryNames] = useState('lodash.js\nluxon.js');
  const [inventory, setInventory] = useState<ScriptInventory>();
  const [discovering, setDiscovering] = useState(false);
  const [planningSearches, setPlanningSearches] = useState(false);
  const [pageSearchError, setPageSearchError] = useState<SuiteLensErrorShape>();
  const [pageSearchPlan, setPageSearchPlan] = useState<{
    found: number;
    added: number;
    atLimit: boolean;
  }>();
  const [discoveredPlan, setDiscoveredPlan] = useState<ImpactScanPlan>();
  const [progress, setProgress] = useState<ImpactScanProgress>();
  const [error, setError] = useState<SuiteLensErrorShape>();
  const [running, setRunning] = useState(false);
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [fileQuery, setFileQuery] = useState('');
  /** undefined = automatic (open before the first scan, folded after it). */
  const [optionsChoice, setOptionsChoice] = useState<boolean>();
  const suggestions = useFieldSuggestions(adapter, context);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const now = useNow();
  useEffect(() => {
    mounted.current = true;
    void getAccountSettings(context.accountId).then(
      (settings) => {
        if (mounted.current) setCacheIndex(settings.cacheImpactIndex ?? true);
      },
      () => {
        if (mounted.current) setCacheIndex(false);
      },
    );
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, [context.accountId]);

  const changeIndexPreference = async (enabled: boolean) => {
    setSavingIndex(true);
    setProgress(undefined);
    setError(undefined);
    try {
      await updateAccountSettings(context.accountId, { cacheImpactIndex: enabled });
      if (mounted.current) setCacheIndex(enabled);
      if (!enabled) {
        await cacheStore.clearKind(context.accountId, 'impact-index');
        await cacheStore.clearKind(context.accountId, 'impact-miss');
      }
    } catch (err) {
      if (mounted.current) setError(toSuiteLensError(err).toShape());
    } finally {
      if (mounted.current) setSavingIndex(false);
    }
  };

  const lines = files
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const text = line.trim();
      // A bare customsearch_* script ID is unambiguous; bare numbers are not.
      if (/^customsearch_\w+$/i.test(text)) return { source: 'saved-search', id: text };
      const [source, id, extra] = text.split(':');
      return { source, id: extra === undefined ? id?.trim() : undefined };
    });
  const searches = lines.filter((line) => line.source === 'saved-search').map((line) => line.id);
  const parsed = ImpactScanPlanSchema.safeParse({
    accountId: context.accountId,
    target: target.trim(),
    files: lines
      .filter((line) => line.source !== 'saved-search')
      .map((line) => ({ source: line.source, fileId: line.id })),
    ...(searches.length ? { searches } : {}),
  });

  const names = new Map(inventory?.files.map((file) => [file.fileId, file.name]));
  const targetValid = ImpactScanPlanSchema.shape.target.safeParse(target.trim()).success;
  const libraryNamesParsed = parseLibraryFileNames(libraryNames);
  const exclusionsValid = !excludeLibraries || libraryNamesParsed.success;
  const folderValid = !folder.trim() || FolderIdPattern.test(folder.trim());
  const busy =
    running || discovering || planningSearches || savingIndex || cacheIndex === undefined;

  const addPageSearches = async () => {
    if (busy || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setPlanningSearches(true);
    setPageSearchPlan(undefined);
    setPageSearchError(undefined);
    try {
      const result = await planPageSearches(adapter, context, files, abort.signal);
      if (!mounted.current || abort.signal.aborted) return;
      if (result.added) edit(setFiles, result.value);
      setPageSearchPlan(result);
    } catch (err) {
      if (mounted.current && !abort.signal.aborted)
        setPageSearchError(toSuiteLensError(err).toShape());
    } finally {
      if (controller.current === abort) controller.current = null;
      if (mounted.current) setPlanningSearches(false);
    }
  };

  const scanAll = async () => {
    if (!targetValid || !folderValid || !exclusionsValid || controller.current || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setDiscovering(true);
    setError(undefined);
    setProgress(undefined);
    setInventory(undefined);
    setDiscoveredPlan(undefined);
    try {
      const found = await discoverScriptFiles(adapter, {
        accountId: context.accountId,
        signal: abort.signal,
        ...(excludeLibraries && libraryNamesParsed.success
          ? { excludedLibraryNames: libraryNamesParsed.data }
          : {}),
        ...(folder.trim() ? { folderId: folder.trim() } : {}),
      });
      if (!mounted.current) return;
      setInventory(found);
      const plan = ImpactScanPlanSchema.safeParse({
        accountId: context.accountId,
        target: target.trim(),
        files: found.files.map((file) => ({
          source: 'script',
          fileId: file.fileId,
          ...(file.folderId ? { folderId: file.folderId } : {}),
        })),
      });
      if (!plan.success) {
        const message = t(
          found.excludedLibraries?.length ? 'impact.allScriptsExcluded' : 'impact.noScriptFiles',
        );
        setError({ code: 'UNSUPPORTED', message, detail: message });
        return;
      }
      setDiscoveredPlan(plan.data);
      controller.current = null;
      setDiscovering(false);
      await run(false, plan.data, found.files);
    } catch (err) {
      if (mounted.current) setError(toSuiteLensError(err).toShape());
    } finally {
      controller.current = null;
      if (mounted.current) setDiscovering(false);
    }
  };

  const run = async (
    refresh = false,
    plan: ImpactScanPlan | undefined = discoveredPlan ?? (parsed.success ? parsed.data : undefined),
    freshInventory?: ScriptInventory['files'],
  ) => {
    if (!plan || controller.current || cacheIndex === undefined || savingIndex) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setError(undefined);
    setProgress(undefined);
    try {
      const result = await scanner.run(plan, {
        signal: abort.signal,
        refresh,
        cacheIndex,
        ...(freshInventory
          ? { inventory: freshInventory }
          : discoveredPlan === plan && inventory
            ? { inventory: inventory.files, resume: true }
            : {}),
        onProgress: (value) => {
          if (mounted.current) setProgress(value);
        },
      });
      if (mounted.current) setProgress(result);
    } catch (err) {
      if (mounted.current) {
        setProgress(undefined);
        setError(toSuiteLensError(err).toShape());
      }
    } finally {
      controller.current = null;
      if (mounted.current) setRunning(false);
    }
  };
  const edit = (setter: (text: string) => void, text: string) => {
    setter(text);
    setDiscoveredPlan(undefined);
    setInventory(undefined);
    setProgress(undefined);
    setError(undefined);
    setPageSearchPlan(undefined);
    setPageSearchError(undefined);
  };

  // A cancelled scan (all scripts or a chosen plan) resumes from the main button.
  const resumable = progress?.status === 'cancelled';
  const scanLabel = t(resumable ? 'impact.resume' : 'impact.scanAll');
  const manualLabel = t('impact.scan');
  const scanDisabled = resumable ? busy : busy || !targetValid || !folderValid || !exclusionsValid;
  const libraryCount =
    excludeLibraries && libraryNamesParsed.success ? libraryNamesParsed.data.length : 0;
  const summary = [
    inventory
      ? t('impact.summary.files', { count: inventory.files.length })
      : parsed.success && files.trim()
        ? t('impact.summary.manual', {
            count: parsed.data.files.length + (parsed.data.searches?.length ?? 0),
          })
        : t('impact.summary.allScripts'),
    folder.trim() && folderValid && t('impact.summary.folder', { id: folder.trim() }),
    libraryCount > 0 && t('impact.summary.libraries', { count: libraryCount }),
    t(cacheIndex ? 'impact.summary.indexOn' : 'impact.summary.indexOff'),
  ]
    .filter(Boolean)
    .join(' · ');
  // Options are open until the first scan, then fold into the summary line (ADR 0051).
  const optionsOpen = optionsChoice ?? (!progress && !running && !discovering && !error);
  const notChecked = progress ? notCheckedGroups(progress.results) : [];

  return (
    <div className="@container">
      <form
        className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-canvas p-3"
        onSubmit={(event) => {
          event.preventDefault();
          setDiscoveredPlan(undefined);
          setOptionsChoice(false);
          void run(false, parsed.success ? parsed.data : undefined);
        }}
      >
        <h2 className="sr-only">{t('impact.title')}</h2>
        <ScanBar
          target={target}
          onTarget={(value) => edit(setTarget, value)}
          targetDisabled={running || planningSearches}
          suggestions={suggestions}
          scanLabel={scanLabel}
          scanDisabled={scanDisabled}
          onScan={() => {
            setOptionsChoice(false);
            void (resumable ? run() : scanAll());
          }}
          cancellable={running || discovering || planningSearches}
          onCancel={() => controller.current?.abort()}
          optionsOpen={optionsOpen}
          onToggleOptions={() => setOptionsChoice(!optionsOpen)}
          summary={summary}
        >
          {/* Kept mounted while folded, so drafts and disclosure state survive. */}
          <div hidden={!optionsOpen}>
            <ScanOptions
              folder={folder}
              folderValid={folderValid}
              onFolder={(value) => edit(setFolder, value)}
              excludeLibraries={excludeLibraries}
              onExcludeLibraries={(enabled) => {
                setExcludeLibraries(enabled);
                setDiscoveredPlan(undefined);
                setInventory(undefined);
                setProgress(undefined);
                setError(undefined);
              }}
              libraryNames={libraryNames}
              libraryNamesValid={libraryNamesParsed.success}
              onLibraryNames={(value) => edit(setLibraryNames, value)}
              cacheIndex={cacheIndex ?? false}
              onCacheIndex={(enabled) => void changeIndexPreference(enabled)}
              files={files}
              filesValid={parsed.success}
              onFiles={(value) => edit(setFiles, value)}
              prefilled={!!initialFiles?.length}
              pageSearch={{
                onAdd: () => void addPageSearches(),
                error: pageSearchError,
                plan: pageSearchPlan,
              }}
              busy={busy}
              scanLabel={manualLabel}
            />
          </div>
          <ScanProgress
            progress={progress}
            discovering={discovering}
            planningSearches={planningSearches}
            running={running}
          />
        </ScanBar>
      </form>
      <PdfEditorScan
        adapter={adapter}
        context={context}
        target={target}
        disabled={busy || !targetValid}
      />
      <div className="flex flex-col gap-2 p-3">
        {error && <ErrorPanel error={error} onRetry={() => void run()} />}
        {!progress && inventory && <InventoryNotes inventory={inventory} />}
        {!progress && !error && !running && !discovering && (
          <EmptyState title={t('impact.initial')} body={t('impact.initialBody')} />
        )}
        {progress && (
          <div className="flex flex-col gap-2 @[1000px]:grid @[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @[1000px]:items-start">
            <div className="flex min-w-0 flex-col gap-2">
              <ResultsHeader
                progress={progress}
                now={now}
                busy={busy || (!discoveredPlan && !parsed.success)}
                onRescan={() => void run(true)}
              />
              {progress.results.length > 0 && (
                <FileResultFilters
                  counts={countFileResults(progress.results)}
                  filter={fileFilter}
                  onFilter={setFileFilter}
                  query={fileQuery}
                  onQuery={setFileQuery}
                />
              )}
              {!!progress.plan.files.length && (
                <FileNames
                  key={JSON.stringify([context.accountId, context.url, progress.plan])}
                  adapter={adapter}
                  plan={progress.plan}
                  pageUrl={context.url}
                  names={names}
                  disabled={busy}
                  auto={progress.status === 'complete'}
                >
                  {(fileNames) =>
                    (['script', 'pdf-template'] as const).map((source) => {
                      const planned = progress.plan.files.filter((file) => file.source === source);
                      if (!planned.length) return null;
                      return (
                        <FileResultSection
                          key={source}
                          label={t(`impact.${source}`)}
                          planned={planned.length}
                          results={progress.results.filter((file) => file.source === source)}
                          filter={fileFilter}
                          query={fileQuery}
                          names={fileNames}
                        />
                      );
                    })
                  }
                </FileNames>
              )}
              {!!progress.plan.searches?.length && <SavedSearchResults progress={progress} />}
            </div>
            <CoverageSection progress={progress} inventory={inventory} notChecked={notChecked}>
              {progress.plan.files.some((file) => file.source === 'script') && (
                <ScriptMetadata
                  key={JSON.stringify([
                    'script-metadata',
                    context.accountId,
                    context.url,
                    context.recordType,
                    progress.plan,
                  ])}
                  adapter={adapter}
                  context={context}
                  progress={progress}
                  disabled={busy}
                  auto={progress.status === 'complete'}
                />
              )}
            </CoverageSection>
          </div>
        )}
      </div>
    </div>
  );
}

function SavedSearchResults({ progress }: { progress: ImpactScanProgress }) {
  const searches = progress.plan.searches ?? [];
  return (
    <section className="flex flex-col gap-2" aria-label={t('impact.saved-search')}>
      <h3 className="text-xs font-semibold text-fg-muted">
        {t('impact.saved-search')} ({progress.searchResults.length}/{searches.length})
      </h3>
      {progress.searchResults.map((search) => (
        <div key={search.searchId} className="rounded-lg border border-line bg-surface p-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <p className="font-semibold">
              {search.title ?? t('impact.search', { id: search.searchId })}
            </p>
            {search.isPublic !== undefined && (
              <Badge tone={search.isPublic ? 'warning' : 'neutral'}>
                {t(search.isPublic ? 'impact.public' : 'impact.private')}
              </Badge>
            )}
            {search.status === 'not-checked' && (
              <Badge tone="warning">{t('impact.notChecked')}</Badge>
            )}
          </div>
          <p className="text-fg-subtlest">{t('impact.search', { id: search.searchId })}</p>
          {search.objectUrl && (
            <a
              className="block text-accent hover:underline"
              href={search.objectUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('impact.openObject')} ↗
            </a>
          )}
          {search.status === 'not-checked' && <p>{reasonText(search.reason)}</p>}
          {search.status === 'checked' && !search.hits.length && <p>{t('impact.noSearchHits')}</p>}
          {!!search.hits.length && (
            <ul className="flex flex-col gap-1">
              {search.hits.map((hit, index) => (
                <li key={index}>
                  {t('impact.searchHit', {
                    area: t(`impact.area.${hit.area}`),
                    member: hit.member,
                    part: t(`impact.part.${hit.part}`),
                  })}
                  <span className="block text-fg-subtlest">{t(`impact.${hit.kind}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
