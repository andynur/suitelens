import { expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { SuiteLensError } from '../../netsuite/errors';
import { discoverScriptFiles } from './discover';

const accountId = recordContext().accountId;

it('lists unique script files from script records, leaving bundle-owned files out', async () => {
  const result = await discoverScriptFiles(fixtureAdapter(), { accountId });
  // 888 sits in folder 900, whose parent is the SuiteBundles root; NetSuite will not serve it.
  expect(result.files.map((file) => file.fileId)).toEqual(['501', '999']);
  expect(result.files.map((file) => file.name)).toEqual(['ue_demo_flag.js', 'missing_fixture.js']);
  expect(result).toMatchObject({
    total: 2,
    folderLimited: false,
    detailsUnavailable: false,
    bundleSkipped: 1,
  });
});

it('keeps every file when the bundle root cannot be resolved', async () => {
  const adapter = fixtureAdapter();
  const original = adapter.runSuiteQL.bind(adapter);
  vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) =>
    sql.includes("name = 'SuiteBundles'")
      ? { accountId: options.accountId, rows: [], atLimit: false }
      : original(sql, options),
  );
  const result = await discoverScriptFiles(adapter, { accountId });
  expect(result.files.map((file) => file.fileId)).toEqual(['501', '999', '888']);
  expect(result.bundleSkipped).toBe(0);
});

it('adds files of one folder tree and rejects invalid folder IDs', async () => {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  const result = await discoverScriptFiles(adapter, { accountId, folderId: '-15' });
  expect(result.files.map((file) => file.fileId)).toEqual(['501', '999', '777']);
  // IDs, folder files, subfolders, details, bundle root, folder parents: one call each,
  // never one call per folder.
  expect(run.mock.calls).toHaveLength(6);
  expect(run.mock.calls.filter(([sql]) => sql.includes('IN ('))).toHaveLength(4);
  await expect(discoverScriptFiles(adapter, { accountId, folderId: '1; drop' })).rejects.toThrow(
    'numeric',
  );
});

it('keeps discovered IDs when the file metadata read fails', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) => {
    if (sql.includes('IN ('))
      throw new SuiteLensError('PERMISSION_DENIED', 'The file table is not available.');
    return { accountId: options.accountId, rows: [{ id: 501 }], atLimit: false };
  });
  const result = await discoverScriptFiles(adapter, { accountId });
  expect(result.files).toEqual([{ fileId: '501', name: '' }]);
  expect(result.detailsUnavailable).toBe(true);
});

it('explains a folder timeout as a narrowable scan', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) => {
    if (sql.includes('FROM file')) throw new SuiteLensError('TIMEOUT', 'Query timed out.');
    return { accountId: options.accountId, rows: [], atLimit: false };
  });
  await expect(discoverScriptFiles(adapter, { accountId, folderId: '-15' })).rejects.toMatchObject({
    code: 'TIMEOUT',
    detail: expect.stringContaining('smaller subfolder'),
  });
});

it('excludes only explicitly selected exact basenames before the plan cap', async () => {
  const adapter = fixtureAdapter();
  const rows = Array.from({ length: 503 }, (_, i) => ({
    id: i + 1,
    name: i === 0 ? 'lodash.js' : i === 1 ? 'luxon.js' : i === 2 ? 'Lodash.js' : `business_${i}.js`,
  }));
  const query = vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) => ({
    accountId: options.accountId,
    rows: sql.includes('FROM script')
      ? rows.map(({ id }) => ({ id }))
      : rows.filter(({ id }) => options.params?.includes(String(id))),
    atLimit: false,
  }));
  const unfiltered = await discoverScriptFiles(adapter, { accountId });
  expect(unfiltered.files[0]!.name).toBe('lodash.js');
  const filtered = await discoverScriptFiles(adapter, {
    accountId,
    excludedLibraryNames: ['lodash.js', 'luxon.js'],
  });
  expect(filtered.excludedLibraries?.map((file) => file.name)).toEqual(['lodash.js', 'luxon.js']);
  expect(filtered.files).toHaveLength(500);
  expect(filtered.total).toBe(501);
  expect(filtered.files[0]!.name).toBe('Lodash.js');
  const before = query.mock.calls.length;
  await expect(
    discoverScriptFiles(adapter, { accountId, excludedLibraryNames: ['*.js'] }),
  ).rejects.toThrow();
  expect(query.mock.calls).toHaveLength(before);
});

it('keeps unnamed files when exclusions are enabled and metadata is unreadable', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) => {
    if (sql.includes('FROM file')) throw new SuiteLensError('PERMISSION_DENIED', 'No metadata');
    return { accountId: options.accountId, rows: [{ id: 328 }], atLimit: false };
  });
  const result = await discoverScriptFiles(adapter, {
    accountId,
    excludedLibraryNames: ['lodash.js'],
  });
  expect(result.files).toEqual([{ fileId: '328', name: '' }]);
  expect(result.excludedLibraries).toBeUndefined();
});
