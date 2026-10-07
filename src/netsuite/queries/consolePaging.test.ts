import { describe, expect, it, vi } from 'vitest';
import {
  collectConsolePages,
  consolePageSql,
  placeholderCount,
  validateParameters,
} from './console';

const accountId = '1234567-sb1';
const page = (count: number) => ({
  accountId,
  rows: Array.from({ length: count }, (_, id) => ({ id })),
  atLimit: false,
});
describe('automatic paging and bound parameters', () => {
  it('collects more than 5,000 rows sequentially and reports progress', async () => {
    const fetch = vi.fn(async (offset: number) => page(offset < 6000 ? 1000 : 1));
    const progress = vi.fn();
    const result = await collectConsolePages(fetch, { accountId, onProgress: progress });
    expect(result.rows).toHaveLength(6001);
    expect(result.atLimit).toBe(false);
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      0, 1000, 2000, 3000, 4000, 5000, 6000,
    ]);
    expect(progress.mock.calls.map((call) => call[0])).toEqual([
      1000, 2000, 3000, 4000, 5000, 6000, 6001,
    ]);
  });
  it('enforces the configurable cap including a partial final page', async () => {
    const fetch = vi.fn(async () => page(1000));
    const result = await collectConsolePages(fetch, { accountId, maxRows: 1500 });
    expect(result.rows).toHaveLength(1500);
    expect(result.atLimit).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      (await collectConsolePages(async () => page(10), { accountId, maxRows: 5 })).atLimit,
    ).toBe(true);
  });
  it('does not fetch another page after cancel and rejects a different account', async () => {
    const abort = new AbortController();
    const fetch = vi.fn(async () => page(1000));
    await expect(
      collectConsolePages(fetch, {
        accountId,
        signal: abort.signal,
        onProgress: () => abort.abort(),
      }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(
      collectConsolePages(async () => ({ ...page(1), accountId: 'other' }), { accountId }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
  });
  it('preserves SQL aliases, strips trailing comments after a semicolon and reserves the paging alias', () => {
    const sql = consolePageSql(
      'SELECT id AS internalid FROM transaction ORDER BY id; -- trailing',
      1000,
    );
    expect(sql).toContain('SELECT id AS internalid FROM transaction ORDER BY id');
    expect(sql).toContain('ROWNUM <= 2000');
    expect(sql).toContain('suitelens_page_row > 1000');
    expect(() => consolePageSql('SELECT id AS suitelens_page_row FROM transaction', 0)).toThrow(
      'reserved',
    );
  });
  it('counts placeholders outside literals and binds scalar values without interpolation', () => {
    const sql = `SELECT '?' AS "?", id FROM transaction /* ? */ WHERE id = ? -- ?\nAND tranid = ?`;
    expect(placeholderCount(sql)).toBe(2);
    expect(validateParameters(sql, [1, "' OR 1=1"])).toEqual([1, "' OR 1=1"]);
    expect(() => validateParameters(sql, [1])).toThrow('one value');
    expect(() => validateParameters(sql, [NaN, {}])).toThrow();
  });
});
