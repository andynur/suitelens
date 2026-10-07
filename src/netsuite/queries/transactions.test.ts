import { describe, expect, it, vi } from 'vitest';
import { fixtureAdapter } from '../../test/adapters';
import { loadFixtureSet } from '../adapter/fixtureSet';
import { SuiteLensError } from '../errors';
import {
  validateConsoleSql,
  validateParameters,
  type ConsoleOptions,
  type ConsoleResult,
} from './console';
import {
  isTransactionType,
  loadTransactionGraph,
  mapTransactionLinks,
  transactionBranches,
  transactionLinksQuery,
  TRANSACTION_LIMITS,
} from './transactions';

const accountId = '1234567-sb1';
const root = { id: '1001', number: '1001', type: 'salesorder' };
const result = (rows: ConsoleResult['rows'], atLimit = false): ConsoleResult => ({
  accountId,
  rows,
  atLimit,
});
const row = (previous: number, next: number) => ({
  previousid: previous,
  previousnumber: `T-${previous}`,
  previoustype: 'SalesOrd',
  nextid: next,
  nextnumber: `T-${next}`,
  nexttype: 'CustInvc',
  linktype: 'OrdBill',
});
const fixtureRows = () => loadFixtureSet().suiteql['transactions.links']!;

it('uses read-only bound IDs and rejects unsafe identifiers and oversized batches', () => {
  const query = transactionLinksQuery(['1001', '1201']);
  expect(validateConsoleSql(query.sql)).toBe(query.sql);
  expect(validateParameters(query.sql, query.params)).toEqual(['1001', '1201', '1001', '1201']);
  for (const ids of [[], ['1; DELETE'], ['-1'], ['0'], Array.from({ length: 26 }, () => '1')]) {
    expect(() => transactionLinksQuery(ids)).toThrow('Invalid transaction IDs');
  }
  expect(isTransactionType('customerpayment')).toBe(true);
  expect(isTransactionType('itemfulfillment')).toBe(true);
  expect(isTransactionType('customer')).toBe(false);
  expect(isTransactionType('customrecord_demo')).toBe(false);
});

it('maps fixture links, deduplicates line-level repeats and rejects malformed rows', () => {
  const graph = mapTransactionLinks(fixtureRows());
  expect(graph.nodes).toHaveLength(4);
  expect(graph.edges).toHaveLength(3);
  expect(graph.edges).toContainEqual({ previous: '1201', next: '1301', linkType: 'Payment' });
  expect(() => mapTransactionLinks([{ ...row(1, 2), nextid: 'unsafe' }])).toThrow(
    'Unexpected transaction',
  );
  expect(() => mapTransactionLinks([{}])).toThrow('Unexpected transaction');
  expect(
    mapTransactionLinks([{ ...row(1, 1), previousnumber: null, linktype: null }]).edges,
  ).toEqual([]);
});

it('walks fixture relationships from either endpoint without inventing a fulfillment-to-invoice link', async () => {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  const graph = await loadTransactionGraph(root, adapter.runSuiteQL, { accountId });
  expect(graph.nodes).toHaveLength(4);
  expect(graph.nodes[0]?.number).toBe('SO-FAKE-1001');
  expect(graph.edges).toHaveLength(3);
  expect(graph.limited).toBe(false);
  expect(run).toHaveBeenCalledTimes(3);
  const tree = transactionBranches(graph);
  expect(tree.children.map((child) => child.node.id)).toEqual(['1101', '1201']);
  expect(tree.children[1]?.children[0]?.node.id).toBe('1301');
  const reverse = await loadTransactionGraph({ ...root, id: '1301' }, adapter.runSuiteQL, {
    accountId,
  });
  expect(reverse.nodes).toHaveLength(4);
  expect(transactionBranches(reverse).children[0]?.direction).toBe('previous');
});

it('stops cycles and marks shared records as references', async () => {
  const rows = [row(1, 2), row(2, 3), row(3, 1), row(1, 4), row(4, 3)];
  const run = vi.fn(async (_sql: string, options: ConsoleOptions) =>
    result(
      rows.filter(
        (link) =>
          options.params!.includes(String(link.previousid)) ||
          options.params!.includes(String(link.nextid)),
      ),
    ),
  );
  const graph = await loadTransactionGraph({ ...root, id: '1' }, run, { accountId });
  expect(graph.nodes).toHaveLength(4);
  expect(run).toHaveBeenCalledTimes(2);
  const tree = transactionBranches(graph);
  const serialized = JSON.stringify(tree);
  expect(serialized).toContain('"reference":true');
  expect(serialized.length).toBeLessThan(4000);
});

describe('bounded and incomplete reads', () => {
  it('keeps empty results honest and reports query row caps', async () => {
    const graph = await loadTransactionGraph(root, async () => result([]), { accountId });
    expect(graph.edges).toEqual([]);
    expect(graph.limited).toBe(false);
    const capped = await loadTransactionGraph(root, async () => result([], true), { accountId });
    expect(capped.limited).toBe(true);
  });

  it('caps node count and parameter batch size', async () => {
    const run = vi.fn(async (_sql: string, options: ConsoleOptions) =>
      result(
        options.params![0] === '1'
          ? Array.from({ length: 110 }, (_, index) => row(1, index + 2))
          : [],
      ),
    );
    const graph = await loadTransactionGraph({ ...root, id: '1' }, run, { accountId });
    expect(graph.nodes).toHaveLength(TRANSACTION_LIMITS.nodes);
    expect(graph.edges).toHaveLength(99);
    expect(graph.limited).toBe(true);
    for (const [, options] of run.mock.calls)
      expect(options.params!.length).toBeLessThanOrEqual(50);
  });

  it('caps traversal depth', async () => {
    const run = vi.fn(async (_sql: string, options: ConsoleOptions) => {
      const id = Number(options.params![0]);
      return result([row(id, id + 1)]);
    });
    const graph = await loadTransactionGraph({ ...root, id: '1' }, run, { accountId });
    expect(run).toHaveBeenCalledTimes(4);
    expect(graph.nodes).toHaveLength(5);
    expect(graph.limited).toBe(true);
  });

  it('caps total edge count across batches', async () => {
    const run = vi.fn(async (_sql: string, options: ConsoleOptions) => {
      const id = Number(options.params![0]);
      return result(
        Array.from({ length: 300 }, (_, index) => ({ ...row(id, id + 1), linktype: `L-${index}` })),
      );
    });
    const graph = await loadTransactionGraph({ ...root, id: '1' }, run, { accountId });
    expect(graph.edges).toHaveLength(TRANSACTION_LIMITS.edges);
    expect(graph.limited).toBe(true);
  });
});

it('rejects wrong-account and unrelated responses, and preserves permission failures', async () => {
  await expect(
    loadTransactionGraph(root, async () => ({ ...result([]), accountId: 'other' }), { accountId }),
  ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
  await expect(
    loadTransactionGraph(root, async () => result([row(1, 2)]), { accountId }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  await expect(
    loadTransactionGraph(
      root,
      async () => {
        throw new SuiteLensError('PERMISSION_DENIED', 'Denied');
      },
      { accountId },
    ),
  ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  await expect(
    loadTransactionGraph({ ...root, id: 'unsafe' }, async () => result([]), { accountId }),
  ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
});

it('cancels the whole walk and never dispatches subsequent queries', async () => {
  const controller = new AbortController();
  let resolve!: (value: ConsoleResult) => void;
  const run = vi.fn(
    () =>
      new Promise<ConsoleResult>((r) => {
        resolve = r;
      }),
  );
  const pending = loadTransactionGraph(root, run, { accountId, signal: controller.signal });
  await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  resolve(result([row(1001, 2)]));
  await Promise.resolve();
  expect(run).toHaveBeenCalledTimes(1);
});
