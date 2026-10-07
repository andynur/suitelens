import { z } from 'zod';

/**
 * Script file inventory for Impact (PRD-04 discovery). Read-only SELECTs run through
 * `NetSuiteAdapter.runSuiteQL`.
 *
 * Columns `file.id/name/folder/filesize/lastmodifieddate`, `script.scriptfile` and
 * `mediaitemfolder.id/parent` were observed in one sandbox account; other accounts/roles may
 * differ (VERIFY). A failing query surfaces as a normal query error, never as zero files.
 */
/**
 * Single-table read of the script records' file IDs. Joining `script` to `file` and sorting the
 * joined rows exceeded the query timeout in a production-sized account, so metadata is fetched
 * separately for the capped ID set (see `FILE_DETAILS_SQL`).
 */
export const SCRIPT_FILE_IDS_SQL = `SELECT DISTINCT scriptfile AS id
FROM script
WHERE scriptfile IS NOT NULL
ORDER BY scriptfile`;

/** Placeholder list for an `IN (…)` clause; `count` must be a positive integer. */
function placeholders(count: number): string {
  return Array.from({ length: z.number().int().positive().parse(count) }, () => '?').join(', ');
}

export const FILE_BATCH_SIZE = 100;

export function fileDetailsSql(count: number): string {
  return `SELECT
  id AS id,
  name AS name,
  folder AS folder,
  filesize AS filesize,
  lastmodifieddate AS lastmodified
FROM file
WHERE id IN (${placeholders(count)})
ORDER BY id`;
}

/** Files of several folders in one call; one call per folder timed out on deep trees. */
export function folderFilesSql(count: number): string {
  return `SELECT
  id AS id,
  name AS name,
  folder AS folder,
  filesize AS filesize,
  lastmodifieddate AS lastmodified
FROM file
WHERE folder IN (${placeholders(count)}) AND LOWER(name) LIKE '%.js'
ORDER BY id`;
}

export function subfoldersSql(count: number): string {
  return `SELECT id AS id FROM mediaitemfolder WHERE parent IN (${placeholders(count)}) ORDER BY id`;
}

/**
 * Root of the bundle file tree. NetSuite answers HTTP 500 for bundle-owned script source, so
 * those files are skipped rather than read (ADR 0032). Resolved by name instead of by the
 * observed ID `-16`, which is not documented as stable (VERIFY).
 */
export const BUNDLE_ROOT_SQL = `SELECT id AS id
FROM mediaitemfolder
WHERE name = 'SuiteBundles' AND parent IS NULL`;

/** One level of the ancestor chain; walking up is bounded, enumerating the subtree is not. */
export function folderParentsSql(count: number): string {
  return `SELECT id AS id, parent AS parent
FROM mediaitemfolder
WHERE id IN (${placeholders(count)})`;
}

const ParentRowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  parent: z.union([z.string(), z.number()]).nullish(),
});
const FolderIdText = /^-?[1-9][0-9]{0,19}$/;

/** Maps folder → parent; a folder with no parent is a root and is left out. */
export function mapFolderParents(rows: readonly unknown[]): Map<string, string> {
  const parents = new Map<string, string>();
  for (const raw of rows) {
    const row = ParentRowSchema.safeParse(raw);
    if (!row.success || row.data.parent == null) continue;
    const id = String(row.data.id);
    const parent = String(row.data.parent);
    if (FolderIdText.test(id) && FolderIdText.test(parent)) parents.set(id, parent);
  }
  return parents;
}

export const InventoryFileSchema = z
  .object({
    fileId: z.string().regex(/^[1-9][0-9]{0,19}$/),
    name: z.string().max(512),
    folderId: z
      .string()
      .regex(/^-?[1-9][0-9]{0,19}$/)
      .optional(),
    size: z.number().int().nonnegative().optional(),
    modified: z.string().max(64).optional(),
  })
  .strict();
export type InventoryFile = z.infer<typeof InventoryFileSchema>;

const RowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.union([z.string(), z.number()]).nullish(),
  folder: z.union([z.string(), z.number()]).nullish(),
  filesize: z.union([z.string(), z.number()]).nullish(),
  lastmodified: z.union([z.string(), z.number()]).nullish(),
});

/** Drops malformed or duplicate rows; never throws on one bad row. */
export function mapInventoryRows(rows: readonly unknown[]): InventoryFile[] {
  const seen = new Set<string>();
  const files: InventoryFile[] = [];
  for (const raw of rows) {
    const row = RowSchema.safeParse(raw);
    if (!row.success) continue;
    const size =
      row.data.filesize == null || String(row.data.filesize).trim() === ''
        ? undefined
        : Number(row.data.filesize);
    const file = InventoryFileSchema.safeParse({
      fileId: String(row.data.id),
      name: String(row.data.name ?? ''),
      ...(row.data.folder != null ? { folderId: String(row.data.folder) } : {}),
      ...(size !== undefined && Number.isInteger(size) && size >= 0 ? { size } : {}),
      ...(row.data.lastmodified != null && String(row.data.lastmodified).trim()
        ? { modified: String(row.data.lastmodified) }
        : {}),
    });
    if (!file.success || seen.has(file.data.fileId)) continue;
    seen.add(file.data.fileId);
    files.push(file.data);
  }
  return files;
}

export function mapFolderIds(rows: readonly unknown[]): string[] {
  const ids: string[] = [];
  for (const raw of rows) {
    const id = z.object({ id: z.union([z.string(), z.number()]) }).safeParse(raw);
    if (id.success && /^-?[1-9][0-9]{0,19}$/.test(String(id.data.id))) ids.push(String(id.data.id));
  }
  return ids;
}
