import { expect, it } from 'vitest';
import { parseLibraryFileNames } from './libraryExclusions';

it('accepts only bounded literal JS basenames and preserves case', () => {
  expect(parseLibraryFileNames(' lodash.js\r\n\nLuxon.js ').data).toEqual([
    'lodash.js',
    'Luxon.js',
  ]);
  expect(parseLibraryFileNames('').data).toEqual([]);
  for (const value of [
    '*.js',
    'lib/ue.js',
    'lib\\ue.js',
    'library',
    'x?.js',
    `${'x'.repeat(510)}.js`,
    Array(51).fill('lib.js').join('\n'),
  ]) {
    expect(parseLibraryFileNames(value).success).toBe(false);
  }
});
