import { expect, it } from 'vitest';
import {
  fileDetailsSql,
  folderFilesSql,
  mapFolderIds,
  mapInventoryRows,
  SCRIPT_FILE_IDS_SQL,
  subfoldersSql,
} from './impactFiles';

it('builds batched IN clauses and never joins script to file', () => {
  expect(SCRIPT_FILE_IDS_SQL).not.toMatch(/join/i);
  expect(fileDetailsSql(3)).toContain('id IN (?, ?, ?)');
  expect(folderFilesSql(2)).toContain('folder IN (?, ?)');
  expect(subfoldersSql(1)).toContain('parent IN (?)');
  expect(() => fileDetailsSql(0)).toThrow();
});

it('maps inventory rows, skipping malformed and duplicate ids', () => {
  const files = mapInventoryRows([
    { id: 501, name: 'a.js', folder: 668, filesize: '12', lastmodified: '1/1/2026' },
    { id: '501', name: 'dup.js', folder: 1 },
    { id: 0, name: 'bad.js' },
    { id: 'x1', name: 'bad.js' },
    { name: 'no-id.js' },
    { id: 7, name: null, folder: -15, filesize: null },
  ]);
  expect(files).toEqual([
    { fileId: '501', name: 'a.js', folderId: '668', size: 12, modified: '1/1/2026' },
    { fileId: '7', name: '', folderId: '-15' },
  ]);
});

it('maps folder ids and ignores invalid ones', () => {
  expect(mapFolderIds([{ id: 5 }, { id: '-15' }, { id: 'a' }, { id: 0 }, {}])).toEqual([
    '5',
    '-15',
  ]);
});

it('does not turn blank or invalid revision metadata into an unchanged-file signature', () => {
  expect(
    mapInventoryRows([
      { id: 1, name: 'a.js', filesize: '', lastmodified: ' ' },
      { id: 2, name: 'b.js', filesize: 'invalid', lastmodified: null },
      { id: 3, name: 'c.js', filesize: 0, lastmodified: '2026-10-05' },
    ]),
  ).toEqual([
    { fileId: '1', name: 'a.js' },
    { fileId: '2', name: 'b.js' },
    { fileId: '3', name: 'c.js', size: 0, modified: '2026-10-05' },
  ]);
});
