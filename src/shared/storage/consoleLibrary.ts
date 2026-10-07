import { openDB, type DBSchema } from 'idb';
import { z } from 'zod';
import { isValidAccountId } from '../../netsuite/context/environment';
import { ConsoleSqlSchema } from '../../netsuite/queries/console';

export const SnippetSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  tags: z.array(z.string().max(60)).max(20),
  sql: ConsoleSqlSchema,
  variables: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        type: z.enum(['string', 'number', 'boolean']),
        value: z.string().max(1000),
      }),
    )
    .max(100),
});
export type Snippet = z.infer<typeof SnippetSchema>;
export const MetadataTableSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/i),
  columns: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/i)).max(2000),
  source: z.enum(['observed', 'custom', 'imported']),
});
export const LibrarySchema = z.object({
  history: z
    .array(
      z.object({
        sql: ConsoleSqlSchema,
        at: z.number(),
        status: z.enum(['success', 'error']),
        rows: z.number().int().min(0),
        ms: z.number().min(0),
      }),
    )
    .max(100),
  snippets: z.array(SnippetSchema).max(200),
  metadata: z
    .object({
      tables: z.array(MetadataTableSchema).max(5000),
      next: z.number().int().min(0),
      indexedAt: z.number().optional(),
    })
    .optional(),
});
export type ConsoleLibrary = z.infer<typeof LibrarySchema>;
export type MetadataTable = z.infer<typeof MetadataTableSchema>;
interface LibraryDB extends DBSchema {
  accounts: { key: string; value: ConsoleLibrary };
}
export const EMPTY_LIBRARY: ConsoleLibrary = { history: [], snippets: [] };

export function createConsoleLibraryStorage(name = 'netsuite-suitelens-library') {
  const database = openDB<LibraryDB>(name, 1, {
    upgrade(db) {
      db.createObjectStore('accounts');
    },
  });
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(run: () => Promise<T>) {
    const next = queue.then(run);
    queue = next.catch(() => undefined);
    return next;
  }
  const check = (account: string) => {
    if (!isValidAccountId(account)) throw new Error('Invalid account');
  };
  return {
    async load(account: string) {
      check(account);
      await queue;
      return LibrarySchema.parse(
        (await (await database).get('accounts', account)) ?? EMPTY_LIBRARY,
      );
    },
    update(account: string, change: (previous: ConsoleLibrary) => ConsoleLibrary) {
      check(account);
      return enqueue(async () => {
        const db = await database;
        const tx = db.transaction('accounts', 'readwrite');
        const next = LibrarySchema.parse(
          change(LibrarySchema.parse((await tx.store.get(account)) ?? EMPTY_LIBRARY)),
        );
        await tx.store.put(next, account);
        await tx.done;
        return next;
      });
    },
    clearAccount(account: string) {
      check(account);
      return enqueue(async () => {
        await (await database).delete('accounts', account);
      });
    },
    clearAll() {
      return enqueue(async () => {
        await (await database).clear('accounts');
      });
    },
  };
}
let shared: ReturnType<typeof createConsoleLibraryStorage> | undefined;
export const getConsoleLibraryStorage = () => (shared ??= createConsoleLibraryStorage());
export function importSnippets(text: string): Snippet[] {
  const file = z
    .object({ version: z.literal(1), snippets: z.array(SnippetSchema).max(200) })
    .parse(JSON.parse(text));
  return file.snippets.map((snippet) => ({ ...snippet, id: crypto.randomUUID() }));
}
