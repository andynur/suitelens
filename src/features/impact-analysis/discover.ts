import { LibraryFileNamesSchema } from './libraryExclusions';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError, toSuiteLensError } from '../../netsuite/errors';
import {
  BUNDLE_ROOT_SQL,
  FILE_BATCH_SIZE,
  fileDetailsSql,
  folderParentsSql,
  mapFolderParents,
  folderFilesSql,
  mapFolderIds,
  mapInventoryRows,
  SCRIPT_FILE_IDS_SQL,
  subfoldersSql,
  type InventoryFile,
} from '../../netsuite/queries/impactFiles';

export const DISCOVERY_LIMITS = {
  files: 500,
  folders: 200,
  rows: 5000,
  /** Files whose folder is resolved before the plan cap is applied. */
  inventory: 2000,
  /** Maximum File Cabinet folder nesting walked when looking for the bundle root. */
  depth: 20,
} as const;
export const FolderIdPattern = /^-?[1-9][0-9]{0,19}$/;

export type ScriptInventory = {
  files: InventoryFile[];
  /** Files found before the plan cap; more than `files.length` when truncated. */
  total: number;
  folderLimited: boolean;
  /** True when file names and sizes could not be read; IDs stay usable for a scan. */
  detailsUnavailable: boolean;
  /** Bundle-owned files left out of the plan; NetSuite will not serve their source. */
  bundleSkipped: number;
  /** User-selected exact filename exclusions, outside the scan plan and its cache. */
  excludedLibraries?: InventoryFile[];
};

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    chunks.push(items.slice(index, size + index));
  return chunks;
};

/** Keeps the timeout actionable: the folder tree is the part a user can narrow. */
function describeTimeout(err: unknown, hint: string): unknown {
  const error = toSuiteLensError(err);
  if (error.code !== 'TIMEOUT') return err;
  return new SuiteLensError('TIMEOUT', error.message, hint);
}

/**
 * Lists script files of the account's script records plus, optionally, `.js` files in one
 * File Cabinet folder tree. Discovery never reads file content.
 *
 * Queries are batched (IDs and folders in `IN (…)` lists) because one query per folder and a
 * `script`/`file` join both exceeded the 30-second query timeout in a production-sized account.
 */
export async function discoverScriptFiles(
  adapter: NetSuiteAdapter,
  options: {
    accountId: string;
    signal?: AbortSignal;
    folderId?: string;
    excludedLibraryNames?: string[];
  },
): Promise<ScriptInventory> {
  const { accountId, signal } = options;
  const excludedNames = new Set(LibraryFileNamesSchema.parse(options.excludedLibraryNames ?? []));
  if (options.folderId !== undefined && !FolderIdPattern.test(options.folderId))
    throw new SuiteLensError('UNSUPPORTED', 'Enter a numeric File Cabinet folder internal ID.');
  const run = (sql: string, params?: (string | number)[]) =>
    adapter.runSuiteQL(sql, {
      accountId,
      ...(signal ? { signal } : {}),
      ...(params ? { params } : {}),
      maxRows: DISCOVERY_LIMITS.rows,
    });

  const byId = new Map<string, InventoryFile>();
  const add = (files: InventoryFile[]) => {
    for (const file of files) if (!byId.has(file.fileId)) byId.set(file.fileId, file);
  };

  let scriptFileIds: string[];
  try {
    scriptFileIds = mapFolderIds((await run(SCRIPT_FILE_IDS_SQL)).rows).filter(
      (id) => !id.startsWith('-'),
    );
  } catch (err) {
    throw describeTimeout(err, 'Listing the account script files timed out. Try again.');
  }
  // Names arrive from the detail reads below; the ID alone is enough to read the file.
  for (const id of scriptFileIds) if (!byId.has(id)) byId.set(id, { fileId: id, name: '' });

  let folderLimited = false;
  if (options.folderId) {
    const seen = new Set([options.folderId]);
    let level = [options.folderId];
    try {
      while (level.length && byId.size < DISCOVERY_LIMITS.files) {
        const next: string[] = [];
        for (const folders of chunk(level, FILE_BATCH_SIZE)) {
          add(
            mapInventoryRows((await run(folderFilesSql(folders.length), folders.map(Number))).rows),
          );
          for (const child of mapFolderIds(
            (await run(subfoldersSql(folders.length), folders.map(Number))).rows,
          )) {
            if (seen.has(child)) continue;
            if (seen.size >= DISCOVERY_LIMITS.folders) {
              folderLimited = true;
              continue;
            }
            seen.add(child);
            next.push(child);
          }
        }
        level = next;
      }
    } catch (err) {
      throw describeTimeout(
        err,
        'Reading the folder tree timed out. Scan a smaller subfolder, or leave the folder empty to read script-record files only.',
      );
    }
  }

  // Details are read before the cap so that unreadable bundle files do not consume plan slots.
  const candidates = [...byId.values()].slice(0, DISCOVERY_LIMITS.inventory);
  const missing = candidates.filter((file) => !file.name).map((file) => file.fileId);
  let detailsUnavailable = false;
  if (missing.length) {
    try {
      const details = new Map<string, InventoryFile>();
      for (const batch of chunk(missing, FILE_BATCH_SIZE)) {
        for (const file of mapInventoryRows((await run(fileDetailsSql(batch.length), batch)).rows))
          details.set(file.fileId, file);
      }
      for (const [index, file] of candidates.entries())
        candidates[index] = details.get(file.fileId) ?? file;
    } catch (err) {
      // Metadata is presentational; a failed detail read must not lose the discovered IDs.
      if (toSuiteLensError(err).code === 'CANCELLED') throw err;
      detailsUnavailable = true;
    }
  }

  const bundleFolders = await findBundleFolders(run, candidates);
  const readable = candidates.filter(
    (file) => !(file.folderId && bundleFolders.has(file.folderId)),
  );
  const excludedLibraries = readable.filter((file) => excludedNames.has(file.name));
  const included = readable.filter((file) => !excludedNames.has(file.name));
  return {
    files: included.slice(0, DISCOVERY_LIMITS.files),
    total: included.length,
    ...(excludedLibraries.length ? { excludedLibraries } : {}),
    folderLimited,
    detailsUnavailable,
    bundleSkipped: candidates.length - readable.length,
  };
}

/**
 * Folders of `files` that sit under the bundle root. Walks parents up, which is bounded by tree
 * depth; enumerating the bundle subtree downwards is not. Returns empty when the root or the
 * chain cannot be read, so a failure here only costs the skip, never the scan.
 */
async function findBundleFolders(
  run: (sql: string, params?: (string | number)[]) => Promise<{ rows: readonly unknown[] }>,
  files: readonly InventoryFile[],
): Promise<Set<string>> {
  const inBundle = new Set<string>();
  const folders = [...new Set(files.map((file) => file.folderId).filter((id) => id !== undefined))];
  if (!folders.length) return inBundle;
  try {
    const roots = mapFolderIds((await run(BUNDLE_ROOT_SQL)).rows);
    if (!roots.length) return inBundle;
    const bundleRoots = new Set(roots);
    // folder → parent, filled one level at a time for the folders still being resolved.
    const parents = new Map<string, string>();
    let level = folders.filter((id) => !bundleRoots.has(id));
    for (const id of folders) if (bundleRoots.has(id)) inBundle.add(id);
    for (let depth = 0; depth < DISCOVERY_LIMITS.depth && level.length; depth++) {
      const resolved = new Map<string, string>();
      for (const batch of chunk(level, FILE_BATCH_SIZE))
        for (const [id, parent] of mapFolderParents(
          (await run(folderParentsSql(batch.length), batch.map(Number))).rows,
        ))
          resolved.set(id, parent);
      for (const [id, parent] of resolved) parents.set(id, parent);
      level = [...new Set([...resolved.values()])].filter(
        (parent) => !bundleRoots.has(parent) && !parents.has(parent),
      );
    }
    for (const folder of folders) {
      let current: string | undefined = folder;
      for (let depth = 0; current && depth <= DISCOVERY_LIMITS.depth; depth++) {
        if (bundleRoots.has(current)) {
          inBundle.add(folder);
          break;
        }
        current = parents.get(current);
      }
    }
  } catch (err) {
    if (toSuiteLensError(err).code === 'CANCELLED') throw err;
    return new Set();
  }
  return inBundle;
}
