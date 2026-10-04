import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { isValidAccountId } from '../../netsuite/context/environment';

/**
 * Metadata cache in IndexedDB, namespaced per NetSuite account (CLAUDE.md rule 5).
 * Key: [accountId, kind, key]. Sandbox and production have different account IDs, so
 * their data never mixes.
 */

export const CACHE_DB_NAME = 'netsuite-suitelens';
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type CacheKind = 'automations';

type CacheEntry = {
  accountId: string;
  kind: CacheKind;
  key: string;
  value: unknown;
  storedAt: number;
  ttlMs: number;
};

interface SuiteLensDB extends DBSchema {
  cache: {
    key: [string, string, string];
    value: CacheEntry;
    indexes: { byAccount: string };
  };
}

export type CachedValue<T> = { value: T; storedAt: number };

export type MetadataCache = {
  get<T>(accountId: string, kind: CacheKind, key: string): Promise<CachedValue<T> | undefined>;
  set<T>(accountId: string, kind: CacheKind, key: string, value: T, ttlMs?: number): Promise<void>;
  clearAccount(accountId: string): Promise<void>;
  clearAll(): Promise<void>;
};

export function createMetadataCache(
  options: { dbName?: string; now?: () => number } = {},
): MetadataCache {
  const { dbName = CACHE_DB_NAME, now = Date.now } = options;
  let dbPromise: Promise<IDBPDatabase<SuiteLensDB>> | undefined;

  const db = () =>
    (dbPromise ??= openDB<SuiteLensDB>(dbName, 1, {
      upgrade(database) {
        const store = database.createObjectStore('cache', {
          keyPath: ['accountId', 'kind', 'key'],
        });
        store.createIndex('byAccount', 'accountId');
      },
    }));

  const check = (accountId: string) => {
    if (!isValidAccountId(accountId)) throw new Error('Invalid account ID for cache');
  };

  return {
    async get<T>(accountId: string, kind: CacheKind, key: string) {
      check(accountId);
      const entry = await (await db()).get('cache', [accountId, kind, key]);
      if (!entry || entry.accountId !== accountId) return undefined;
      if (now() - entry.storedAt > entry.ttlMs) {
        await (await db()).delete('cache', [accountId, kind, key]);
        return undefined;
      }
      return { value: entry.value as T, storedAt: entry.storedAt };
    },

    async set<T>(
      accountId: string,
      kind: CacheKind,
      key: string,
      value: T,
      ttlMs = DEFAULT_TTL_MS,
    ) {
      check(accountId);
      await (await db()).put('cache', { accountId, kind, key, value, storedAt: now(), ttlMs });
    },

    async clearAccount(accountId: string) {
      check(accountId);
      const tx = (await db()).transaction('cache', 'readwrite');
      let cursor = await tx.store.index('byAccount').openCursor(IDBKeyRange.only(accountId));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    },

    async clearAll() {
      await (await db()).clear('cache');
    },
  };
}

let shared: MetadataCache | undefined;
export const getMetadataCache = (): MetadataCache => (shared ??= createMetadataCache());
