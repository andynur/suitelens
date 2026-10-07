import { openDB, type DBSchema } from 'idb';
import { z } from 'zod';
import { isValidAccountId } from '../../netsuite/context/environment';

export const MAX_QUERY_TABS = 20;
export const MAX_QUERY_LENGTH = 100_000;

export const QueryWorkspaceSchema = z
  .object({
    activeId: z.string(),
    tabs: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1).max(60),
          sql: z.string().max(MAX_QUERY_LENGTH),
        }),
      )
      .min(1)
      .max(MAX_QUERY_TABS),
  })
  .refine((value) => new Set(value.tabs.map((tab) => tab.id)).size === value.tabs.length)
  .refine((value) => value.tabs.some((tab) => tab.id === value.activeId));
export type QueryWorkspace = z.infer<typeof QueryWorkspaceSchema>;

interface WorkspaceDB extends DBSchema {
  workspaces: { key: string; value: QueryWorkspace };
}

/** Only query drafts are saved here, never record snapshots or query results. */
export function createQueryWorkspaceStorage(dbName = 'netsuite-suitelens-editor') {
  const db = openDB<WorkspaceDB>(dbName, 1, {
    upgrade(database) {
      database.createObjectStore('workspaces');
    },
  });
  // Serialize writes and deletion so an older draft cannot overwrite a newer one or reappear
  // after Delete all data. Recover the queue after an error so subsequent saves can retry.
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation);
    queue = next.catch(() => undefined);
    return next;
  }
  function check(accountId: string) {
    if (!isValidAccountId(accountId)) throw new Error('Invalid account ID for query workspace');
  }
  return {
    async load(accountId: string): Promise<QueryWorkspace | undefined> {
      check(accountId);
      await queue;
      const raw = await (await db).get('workspaces', accountId);
      if (raw === undefined) return undefined;
      return QueryWorkspaceSchema.parse(raw);
    },
    async save(accountId: string, workspace: QueryWorkspace): Promise<void> {
      check(accountId);
      const snapshot = QueryWorkspaceSchema.parse(workspace);
      return enqueue(async () => {
        await (await db).put('workspaces', snapshot, accountId);
      });
    },
    clearAll(): Promise<void> {
      return enqueue(async () => {
        await (await db).clear('workspaces');
      });
    },
  };
}

let shared: ReturnType<typeof createQueryWorkspaceStorage> | undefined;
export const getQueryWorkspaceStorage = () => (shared ??= createQueryWorkspaceStorage());
