import { describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import {
  createQueryWorkspaceStorage,
  MAX_QUERY_LENGTH,
  QueryWorkspaceSchema,
} from './queryWorkspace';

const draft = (sql: string) => ({ activeId: 'one', tabs: [{ id: 'one', name: 'My query', sql }] });
const databaseName = () => `query-workspace-${crypto.randomUUID()}`;

describe('query workspace storage', () => {
  it('restores named tabs and active selection after reopening, isolated by account', async () => {
    const name = databaseName();
    const storage = createQueryWorkspaceStorage(name);
    const workspace = {
      activeId: 'two',
      tabs: [...draft('SELECT 1').tabs, { id: 'two', name: 'Second', sql: 'SELECT 2' }],
    };
    await storage.save('1234567', workspace);
    await storage.save('1234567-sb1', draft('SELECT 3'));
    const reopened = createQueryWorkspaceStorage(name);
    expect(await reopened.load('1234567')).toEqual(workspace);
    expect(await reopened.load('1234567-sb1')).toEqual(draft('SELECT 3'));
    expect(await reopened.load('7654321')).toBeUndefined();
  });

  it('saves a snapshot in order and deletion cannot be undone by queued older writes', async () => {
    const storage = createQueryWorkspaceStorage(databaseName());
    const first = draft('SELECT 1');
    const saving = storage.save('1', first);
    first.tabs[0]!.sql = 'changed after save';
    await saving;
    expect(await storage.load('1')).toEqual(draft('SELECT 1'));
    await Promise.all([storage.save('1', draft('old')), storage.save('1', draft('new'))]);
    expect(await storage.load('1')).toEqual(draft('new'));
    await Promise.all([storage.save('1', draft('pending')), storage.clearAll()]);
    expect(await storage.load('1')).toBeUndefined();
  });

  it('rejects invalid account keys and malformed drafts rather than mixing or overwriting data', async () => {
    const name = databaseName();
    const storage = createQueryWorkspaceStorage(name);
    await expect(storage.save('a:b', draft('SELECT 1'))).rejects.toThrow();
    await expect(storage.load('')).rejects.toThrow();
    expect(QueryWorkspaceSchema.safeParse({ ...draft(''), activeId: 'missing' }).success).toBe(
      false,
    );
    expect(
      QueryWorkspaceSchema.safeParse({
        activeId: 'one',
        tabs: [...draft('').tabs, ...draft('').tabs],
      }).success,
    ).toBe(false);
    await expect(storage.save('1', draft('x'.repeat(MAX_QUERY_LENGTH + 1)))).rejects.toThrow();
    const database = await openDB(name, 1);
    await database.put('workspaces', { broken: true }, '1');
    await expect(storage.load('1')).rejects.toThrow();
    await storage.save('1', draft('recovered'));
    expect(await storage.load('1')).toEqual(draft('recovered'));
    database.close();
  });
});
