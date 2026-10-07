import { z } from 'zod';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { isValidAccountId } from '../../netsuite/context/environment';
import { ErrorCodeSchema, SuiteLensError, type ErrorCode } from '../../netsuite/errors';
import {
  ImpactSourceRequestSchema,
  ImpactSourceSchema,
  PERMANENT_FAILURES,
  sourceFailureKind,
  sourceDisplayLink,
  SourceFailureKindSchema,
  type SourceFailureKind,
} from '../../netsuite/impact/source';
import { ImpactSavedSearchSchema, SavedSearchIdSchema } from '../../netsuite/impact/savedSearch';
import { InventoryFileSchema, type InventoryFile } from '../../netsuite/queries/impactFiles';
import type { MetadataCache } from '../../shared/storage/cache';
import { REFERENCE_LIMITS, scanReferences, type ReferenceHit } from './references';
import { scanSavedSearch } from './searchReferences';
import { scanScriptDependencies, type ScriptDependencies } from './dependencies';
import {
  buildContentIndex,
  ContentIndexSchema,
  hashIndexText,
  scanContentIndex,
} from './contentIndex';

export /** Permanent read failures stay cached well past the 24-hour index TTL; they rarely change. */
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRIPT_EXCERPT_LIMIT = 20;

const FileSchema = ImpactSourceRequestSchema.omit({ accountId: true }).strict();
export const ImpactScanPlanSchema = z
  .object({
    accountId: z.string().refine(isValidAccountId),
    target: z
      .string()
      .max(128)
      .regex(/^(?:[a-zA-Z_][a-zA-Z0-9_]*|[1-9][0-9]*)$/),
    files: z.array(FileSchema).max(500),
    /** Explicit saved-search IDs (internal or customsearch_*); never discovered. */
    searches: z.array(SavedSearchIdSchema).max(100).optional(),
  })
  .strict()
  .refine(
    (plan) =>
      new Set(plan.files.map((file) => file.fileId)).size === plan.files.length &&
      new Set(plan.searches).size === (plan.searches?.length ?? 0) &&
      plan.files.length + (plan.searches?.length ?? 0) > 0,
  );
export type ImpactScanPlan = z.infer<typeof ImpactScanPlanSchema>;

// Explicit allow-list: no source text, excerpts, download tokens or error messages in storage.
const PositionSchema = z
  .object({
    source: z.enum(['script', 'pdf-template']),
    confidence: z.literal('possible'),
    kind: z.enum(['exact-token', 'dynamic-prefix']),
    line: z.number().int().positive(),
    column: z.number().int().positive(),
    offset: z.number().int().nonnegative().max(REFERENCE_LIMITS.characters),
    length: z.number().int().positive().max(128),
  })
  .strict();
const ResultSchema = FileSchema.extend({
  status: z.enum(['checked', 'not-checked']),
  reason: z
    .union([ErrorCodeSchema, z.enum(['invalid-target', 'content-too-large', 'match-limit'])])
    .optional(),
  /** Which read step failed; a closed set, never NetSuite's own error text. */
  failure: SourceFailureKindSchema.optional(),
  hits: z.array(PositionSchema).max(REFERENCE_LIMITS.hits),
  checkedAt: z.number().nonnegative(),
})
  .strict()
  .refine(
    (result) =>
      (result.status === 'checked' ? result.reason === undefined : result.reason !== undefined) &&
      result.hits.every((hit) => hit.source === result.source),
  );
const SearchHitSchema = z
  .object({
    confidence: z.literal('possible'),
    kind: z.enum(['exact-token', 'dynamic-prefix']),
    area: z.enum(['filter', 'column']),
    member: z.number().int().positive().max(500),
    part: z.enum(['name', 'formula']),
  })
  .strict();
// Object metadata only (title, visibility, link); no filter values or search results.
const SearchResultSchema = z
  .object({
    searchId: SavedSearchIdSchema,
    status: z.enum(['checked', 'not-checked']),
    reason: z.union([ErrorCodeSchema, z.enum(['invalid-target', 'match-limit'])]).optional(),
    title: z.string().max(512).optional(),
    isPublic: z.boolean().optional(),
    objectUrl: z.string().url().max(4096).optional(),
    hits: z.array(SearchHitSchema).max(1_000),
    checkedAt: z.number().nonnegative(),
  })
  .strict()
  .refine((result) => (result.status === 'checked') === (result.reason === undefined));
export type ImpactSearchResult = z.infer<typeof SearchResultSchema>;
const CheckpointSchema = z
  .object({
    plan: ImpactScanPlanSchema,
    results: z.array(ResultSchema).max(500),
    searchResults: z.array(SearchResultSchema).max(100).default([]),
    updatedAt: z.number().nonnegative(),
  })
  .strict()
  .refine(
    ({ plan, results, searchResults }) =>
      results.length <= plan.files.length &&
      searchResults.length <= (plan.searches?.length ?? 0) &&
      searchResults.every((result, index) => result.searchId === plan.searches![index]) &&
      results.every(
        (result, index) =>
          result.fileId === plan.files[index]!.fileId &&
          result.source === plan.files[index]!.source,
      ),
  );
export type ImpactScanResult = Omit<z.infer<typeof ResultSchema>, 'hits'> & {
  hits: ReferenceHit[];
  dependencies?: ScriptDependencies;
  /** Observed download URL, run-local only; may contain a download hash. */
  sourceUrl?: string;
  fromIndex?: boolean;
};
export type ImpactScanProgress = Omit<z.infer<typeof CheckpointSchema>, 'results'> & {
  results: ImpactScanResult[];
  status: 'running' | 'cancelled' | 'complete';
  coverage: 'supplied-files-only';
  cacheAvailable: boolean;
};

/** Release the local wait on Cancel; the dispatched adapter read still drains separately. */
async function cancellable<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending;
  let listener: () => void = () => undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    listener = () => reject(new SuiteLensError('CANCELLED', 'Scan cancelled.'));
    if (signal.aborted) listener();
    else signal.addEventListener('abort', listener, { once: true });
  });
  try {
    return await Promise.race([cancelled, pending]);
  } finally {
    signal.removeEventListener('abort', listener);
  }
}

/**
 * F-4.2 foundation for an explicit linked-file plan, never account discovery.
 * One runner per workbench: concurrent runs are rejected; cancellation retains completed
 * checkpoints and discards late source replies. Resume drains any old read before dispatching
 * another. At least 250 ms between reads (no claim of live throttling validation).
 */
export function createImpactScanner(
  adapter: NetSuiteAdapter,
  cache: MetadataCache,
  options: { now?: () => number } = {},
) {
  const now = options.now ?? Date.now;
  let running = false;
  let draining: Promise<void> = Promise.resolve();
  let nextReadAt = 0;

  return {
    async run(
      raw: ImpactScanPlan,
      options: {
        signal?: AbortSignal;
        refresh?: boolean;
        cacheIndex?: boolean;
        /** Fresh discovery metadata; never reuse an old inventory to infer unchanged content. */
        inventory?: readonly InventoryFile[];
        /** Continue a cancelled discovery run with the same fresh inventory. */
        resume?: boolean;
        onProgress?: (progress: ImpactScanProgress) => void;
      } = {},
    ): Promise<ImpactScanProgress> {
      const plan = ImpactScanPlanSchema.parse(raw);
      const inventory = options.inventory
        ? new Map(
            z
              .array(InventoryFileSchema)
              .parse(options.inventory)
              .map((file) => [file.fileId, file]),
          )
        : undefined;
      if (running) throw new SuiteLensError('UNSUPPORTED', 'A scan is already running.');
      running = true;
      const key = JSON.stringify([
        1,
        adapter.kind,
        plan.target,
        plan.files,
        ...(options.inventory ? [options.inventory] : []),
      ]);
      let checkpoint: z.infer<typeof CheckpointSchema> = {
        plan,
        results: [],
        searchResults: [],
        updatedAt: now(),
      };
      // Run-local only: restoring/resuming a checkpoint never rereads files for excerpts.
      const freshHits = new Map<string, ReferenceHit[]>();
      const freshDependencies = new Map<string, ScriptDependencies>();
      const freshLinks = new Map<string, string>();
      const indexFiles = new Set<string>();
      let cacheAvailable = true;
      const snapshot = (status: ImpactScanProgress['status']): ImpactScanProgress => ({
        ...structuredClone(checkpoint),
        results: checkpoint.results.map((result) => ({
          ...structuredClone(result),
          hits: structuredClone(freshHits.get(result.fileId) ?? result.hits),
          ...(freshDependencies.has(result.fileId)
            ? { dependencies: structuredClone(freshDependencies.get(result.fileId)) }
            : {}),
          ...(freshLinks.has(result.fileId) ? { sourceUrl: freshLinks.get(result.fileId) } : {}),
          ...(indexFiles.has(result.fileId) ? { fromIndex: true } : {}),
        })),
        status,
        coverage: 'supplied-files-only',
        cacheAvailable,
      });
      let pageUrl: string | undefined;
      const checkContext = async () => {
        const context = await cancellable(adapter.getPageContext(), options.signal);
        if (context?.accountId !== plan.accountId || (pageUrl && context.url !== pageUrl))
          throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during the scan.');
        pageUrl = context.url;
      };
      const save = async () => {
        try {
          await cache.set(plan.accountId, 'impact-scan', key, checkpoint);
        } catch {
          cacheAvailable = false;
        }
      };
      const waitTurn = async () => {
        await cancellable(draining, options.signal);
        const waitMs = Math.max(0, nextReadAt - Date.now());
        if (!waitMs) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await cancellable(
            new Promise<void>((resolve) => {
              timer = setTimeout(resolve, waitMs);
            }),
            options.signal,
          );
        } finally {
          clearTimeout(timer);
        }
      };
      try {
        await checkContext();
        if (!options.refresh && (!inventory || options.resume)) {
          const cached = await cache.get<unknown>(plan.accountId, 'impact-scan', key).catch(() => {
            cacheAvailable = false;
            return undefined;
          });
          const parsed = CheckpointSchema.safeParse(cached?.value);
          if (parsed.success && JSON.stringify(parsed.data.plan) === JSON.stringify(plan))
            checkpoint = parsed.data;
        }
        await checkContext();
        // Refresh invalidates the old checkpoint even if cancelled before the first new read.
        if (options.refresh || (inventory && !options.resume)) await save();
        options.onProgress?.(snapshot('running'));
        for (let index = checkpoint.results.length; index < plan.files.length; index++) {
          const file = plan.files[index]!;
          let result: ImpactScanResult;
          try {
            const indexKey = JSON.stringify([1, adapter.kind, file.fileId]);
            let existingIndex: z.infer<typeof ContentIndexSchema> | undefined;
            const details = inventory?.get(file.fileId);
            const revision =
              details?.size !== undefined && details.modified?.trim()
                ? { size: details.size, modified: details.modified }
                : undefined;
            let indexedRevision: { size: number; modified: string } | undefined;
            let cachedReason: ErrorCode | undefined;
            if (options.cacheIndex && file.source === 'script') {
              try {
                const cachedIndex = await cache.get<unknown>(
                  plan.accountId,
                  'impact-index',
                  indexKey,
                );
                const parsedIndex = z
                  .object({
                    accountId: z.literal(plan.accountId),
                    fileId: z.literal(file.fileId),
                    adapterKind: z.literal(adapter.kind),
                    index: ContentIndexSchema,
                    revision: z
                      .object({
                        size: z.number().int().nonnegative(),
                        modified: z.string().min(1).max(64),
                      })
                      .strict()
                      .optional(),
                  })
                  .strict()
                  .safeParse(cachedIndex?.value);
                if (parsedIndex.success) {
                  existingIndex = parsedIndex.data.index;
                  indexedRevision = parsedIndex.data.revision;
                }
              } catch {
                cacheAvailable = false;
              }
            }
            // A permanent failure repeats until the file changes; re-reading it costs a full
            // request plus the inter-read delay on every later target.
            let cachedFailure: SourceFailureKind | undefined;
            if (options.cacheIndex && !existingIndex && !options.refresh && !inventory) {
              try {
                const cachedMiss = await cache.get<unknown>(
                  plan.accountId,
                  'impact-miss',
                  indexKey,
                );
                const parsedMiss = z
                  .object({
                    accountId: z.literal(plan.accountId),
                    fileId: z.literal(file.fileId),
                    adapterKind: z.literal(adapter.kind),
                    failure: SourceFailureKindSchema,
                    reason: ErrorCodeSchema,
                  })
                  .strict()
                  .safeParse(cachedMiss?.value);
                if (parsedMiss.success) cachedFailure = parsedMiss.data.failure;
                if (parsedMiss.success) cachedReason = parsedMiss.data.reason;
              } catch {
                cacheAvailable = false;
              }
            }
            await checkContext();
            if (cachedFailure) {
              result = {
                ...file,
                status: 'not-checked',
                hits: [],
                checkedAt: now(),
                reason: cachedReason ?? 'INVALID_RESPONSE',
                failure: cachedFailure,
              };
            } else if (
              existingIndex &&
              !options.refresh &&
              (!inventory ||
                (revision &&
                  indexedRevision &&
                  revision.size === indexedRevision.size &&
                  revision.modified === indexedRevision.modified))
            ) {
              const scanned = await scanContentIndex(existingIndex, plan.target);
              await checkContext();
              indexFiles.add(file.fileId);
              result = {
                ...file,
                status: scanned.status,
                reason: scanned.reason,
                hits: scanned.hits,
                checkedAt: existingIndex.checkedAt,
              };
            } else {
              await waitTurn();
              await checkContext();
              const read = adapter.readImpactSource({ ...file, accountId: plan.accountId });
              draining = read.then(
                () => undefined,
                () => undefined,
              );
              nextReadAt = Date.now() + 250;
              const source = ImpactSourceSchema.parse(await cancellable(read, options.signal));
              await checkContext();
              if (source.accountId !== plan.accountId)
                throw new SuiteLensError('ACCOUNT_MISMATCH', 'Source belongs to another account.');
              if (source.fileId !== file.fileId || source.source !== file.source)
                throw new SuiteLensError(
                  'INVALID_RESPONSE',
                  'Source does not match the requested file.',
                );
              const scanned = scanReferences(source.content, plan.target, file.source, {
                includeExcerpts: file.source === 'script',
                excerptLimit: SCRIPT_EXCERPT_LIMIT,
              });
              const sourceUrl = sourceDisplayLink(source.url, pageUrl!, {
                ...file,
                accountId: plan.accountId,
              });
              if (sourceUrl) freshLinks.set(file.fileId, sourceUrl);
              freshHits.set(file.fileId, scanned.hits);
              if (file.source === 'script')
                freshDependencies.set(file.fileId, scanScriptDependencies(source.content));
              if (options.cacheIndex && file.source === 'script') {
                try {
                  const contentHash = await hashIndexText(source.content);
                  const index =
                    existingIndex?.contentHash === contentHash
                      ? existingIndex
                      : await buildContentIndex(source.content, now(), contentHash);
                  await checkContext();
                  await cache.set(plan.accountId, 'impact-index', indexKey, {
                    accountId: plan.accountId,
                    fileId: file.fileId,
                    adapterKind: adapter.kind,
                    index: { ...index, checkedAt: now() },
                    ...(revision ? { revision } : {}),
                  });
                } catch (error) {
                  if (error instanceof SuiteLensError) throw error;
                  cacheAvailable = false;
                }
              }
              result = {
                ...file,
                status: scanned.status,
                reason: scanned.reason,
                hits: scanned.hits.map(({ excerpt: _excerpt, ...position }) => position),
                checkedAt: now(),
              };
            }
          } catch (error) {
            if (
              error instanceof SuiteLensError &&
              ['CANCELLED', 'ACCOUNT_MISMATCH', 'NOT_NETSUITE'].includes(error.code)
            )
              throw error;
            await checkContext();
            const failure = sourceFailureKind(error);
            result = {
              ...file,
              status: 'not-checked',
              hits: [],
              checkedAt: now(),
              reason: error instanceof SuiteLensError ? error.code : 'INVALID_RESPONSE',
              ...(failure ? { failure } : {}),
            };
            if (options.cacheIndex && failure && PERMANENT_FAILURES.has(failure)) {
              try {
                await cache.set(
                  plan.accountId,
                  'impact-miss',
                  JSON.stringify([1, adapter.kind, file.fileId]),
                  {
                    accountId: plan.accountId,
                    fileId: file.fileId,
                    adapterKind: adapter.kind,
                    failure,
                    reason: result.reason,
                  },
                  MISS_TTL_MS,
                );
              } catch {
                cacheAvailable = false;
              }
            }
          }
          checkpoint.results.push(result);
          checkpoint.updatedAt = now();
          await save();
          options.onProgress?.(snapshot('running'));
        }
        const searches = plan.searches ?? [];
        for (let index = checkpoint.searchResults.length; index < searches.length; index++) {
          const searchId = searches[index]!;
          let result: ImpactSearchResult;
          try {
            await waitTurn();
            await checkContext();
            const read = adapter.readImpactSavedSearch({ accountId: plan.accountId, searchId });
            draining = read.then(
              () => undefined,
              () => undefined,
            );
            nextReadAt = Date.now() + 250;
            const search = ImpactSavedSearchSchema.parse(await cancellable(read, options.signal));
            await checkContext();
            if (search.accountId !== plan.accountId || search.searchId !== searchId)
              throw new SuiteLensError(
                'INVALID_RESPONSE',
                'Saved search does not match the request.',
              );
            const scanned = scanSavedSearch(search.definition, plan.target);
            result = {
              searchId,
              status: scanned.status,
              ...(scanned.reason ? { reason: scanned.reason } : {}),
              title: search.definition.title,
              ...(search.definition.isPublic !== undefined
                ? { isPublic: search.definition.isPublic }
                : {}),
              ...(search.objectUrl ? { objectUrl: search.objectUrl } : {}),
              hits: scanned.hits,
              checkedAt: now(),
            };
          } catch (error) {
            if (
              error instanceof SuiteLensError &&
              ['CANCELLED', 'ACCOUNT_MISMATCH', 'NOT_NETSUITE'].includes(error.code)
            )
              throw error;
            await checkContext();
            result = {
              searchId,
              status: 'not-checked',
              hits: [],
              checkedAt: now(),
              reason: error instanceof SuiteLensError ? error.code : 'INVALID_RESPONSE',
            };
          }
          checkpoint.searchResults.push(result);
          checkpoint.updatedAt = now();
          await save();
          options.onProgress?.(snapshot('running'));
        }
        await checkContext();
        return snapshot('complete');
      } catch (error) {
        if (error instanceof SuiteLensError && error.code === 'CANCELLED')
          return snapshot('cancelled');
        throw error;
      } finally {
        running = false;
      }
    },
  };
}
