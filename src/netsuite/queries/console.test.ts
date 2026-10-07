import { describe, expect, it, vi } from 'vitest';
import { ConsoleRowsSchema, isReadOnlyQuery, waitForConsole, validateConsoleSql } from './console';
import { resolveConsoleFixture } from './consoleFixtures';
import { loadFixtureSet } from '../adapter/fixtureSet';
import { ContentRequestSchema, BridgeOpSchema } from '../bridge/protocol';

describe('console read-only boundary', () => {
  it('removes a terminal semicolon and following comments before N/query execution', () => {
    expect(validateConsoleSql('SELECT id FROM transaction; /* end */')).toBe(
      'SELECT id FROM transaction',
    );
    expect(validateConsoleSql("SELECT ';' FROM transaction")).toBe("SELECT ';' FROM transaction");
  });
  it.each([
    'SELECT id FROM transaction',
    '-- comment\nSELECT id FROM transaction; /* end */',
    'WITH t AS (SELECT id FROM transaction) SELECT * FROM t',
    `SELECT 'DELETE; UPDATE', "update" FROM transaction`,
    `SELECT 'it''s safe' FROM transaction`,
  ])('accepts one read: %s', (sql) => expect(isReadOnlyQuery(sql)).toBe(true));
  it.each([
    '',
    '/* comment */',
    'DELETE FROM transaction',
    'SELECT 1; SELECT 2',
    'SELECT 1;;',
    'SELECT 1; DELETE FROM transaction',
    'SELECT id INTO other FROM transaction',
    'WITH t AS (DELETE FROM transaction) SELECT * FROM t',
    'SELECT * FROM transaction FOR UPDATE',
    "SELECT 'unclosed",
    'SELECT 1 /* unclosed',
  ])('blocks unsafe or incomplete input: %s', (sql) => {
    expect(isReadOnlyQuery(sql)).toBe(false);
    const request = { op: 'runConsoleQuery', accountId: '1234567-sb1', sql };
    expect(ContentRequestSchema.safeParse(request).success).toBe(false);
    expect(BridgeOpSchema.safeParse(request).success).toBe(false);
  });
  it('validates scalar rows and maps exact fake examples without inventing SQL execution', () => {
    const fixtures = loadFixtureSet().suiteql;
    const rows = ConsoleRowsSchema.parse(
      resolveConsoleFixture('SELECT id, tranid FROM transaction WHERE ROWNUM <= 10;', fixtures),
    );
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ id: 1001, tranid: 'SO-DEMO-001' });
    expect(
      resolveConsoleFixture('select id from transaction where rownum <= 10', fixtures)[0],
    ).toEqual({ id: 1001 });
    expect(() => resolveConsoleFixture('select unknown from transaction', fixtures)).toThrow(
      'No matching console fixture',
    );
    expect(ConsoleRowsSchema.safeParse([{ nested: {} }]).success).toBe(false);
  });
  it('cancels before dispatch and while waiting', async () => {
    const controller = new AbortController();
    controller.abort();
    const run = vi.fn(async () => 1);
    await expect(waitForConsole(run, controller.signal)).rejects.toMatchObject({
      code: 'CANCELLED',
    });
    expect(run).not.toHaveBeenCalled();
    const pending = new AbortController();
    const result = waitForConsole(() => new Promise(() => {}), pending.signal);
    pending.abort();
    await expect(result).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  it('times out and prevents later dispatch after an asynchronous prerequisite', async () => {
    vi.useFakeTimers();
    try {
      let effective: AbortSignal | undefined;
      const result = waitForConsole((signal) => {
        effective = signal;
        return new Promise(() => {});
      });
      const assertion = expect(result).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(30_000);
      await assertion;
      expect(effective?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
