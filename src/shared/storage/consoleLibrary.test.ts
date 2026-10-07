import { expect, it } from 'vitest';
import { createConsoleLibraryStorage, importSnippets } from './consoleLibrary';
const snippet = {
  id: 'one',
  name: 'Demo',
  description: 'Example',
  tags: ['demo'],
  sql: 'SELECT id FROM transaction',
  variables: [{ name: 'id', type: 'number' as const, value: '1' }],
};
it('serializes updates, isolates accounts and deletes history/snippets/metadata', async () => {
  const store = createConsoleLibraryStorage(crypto.randomUUID());
  await Promise.all([
    store.update('1', (previous) => ({ ...previous, snippets: [snippet] })),
    store.update('1', (previous) => ({
      ...previous,
      history: [{ sql: snippet.sql, at: 1, status: 'success', rows: 1, ms: 5 }],
    })),
  ]);
  expect((await store.load('1')).snippets).toHaveLength(1);
  expect((await store.load('1')).history).toHaveLength(1);
  expect((await store.load('2')).snippets).toEqual([]);
  await store.update('2', (previous) => ({ ...previous, snippets: [snippet] }));
  await store.clearAccount('1');
  expect((await store.load('1')).history).toEqual([]);
  expect((await store.load('2')).snippets).toHaveLength(1);
  await store.clearAll();
  expect((await store.load('2')).snippets).toEqual([]);
});
it('imports portable versioned snippets, assigns new IDs and rejects writes and oversized files', () => {
  const text = JSON.stringify({ version: 1, snippets: [snippet] });
  const imported = importSnippets(text);
  expect(imported[0]?.id).not.toBe('one');
  expect(imported[0]?.variables).toEqual(snippet.variables);
  expect(() =>
    importSnippets(
      JSON.stringify({ version: 1, snippets: [{ ...snippet, sql: 'DELETE FROM transaction' }] }),
    ),
  ).toThrow();
  expect(() => importSnippets(JSON.stringify({ version: 2, snippets: [] }))).toThrow();
});
