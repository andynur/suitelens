import { describe, expect, it, vi } from 'vitest';
import { readFixture } from '../../test/fixtures';
import { LoupeError } from '../errors';
import { AUTOMATION_QUERIES, SCRIPT_DEPLOYMENTS_QUERY } from './automation';
import {
  AUTOMATION_WARNINGS,
  loadAutomations,
  resolveQuerySql,
  runWithFallback,
  type RunQueryVariant,
} from './runner';

const fixtureRun: RunQueryVariant = async (queryId, variantId) =>
  JSON.parse(readFixture(`suiteql/${queryId}.${variantId}.json`)) as unknown[];

describe('runWithFallback', () => {
  it('returns the first variant that works', async () => {
    const run = vi.fn<RunQueryVariant>(async (_q, v) => {
      if (v === 'full') throw new LoupeError('TABLE_UNAVAILABLE', 'bad column');
      return [{ a: 1 }];
    });
    await expect(runWithFallback(SCRIPT_DEPLOYMENTS_QUERY, run)).resolves.toEqual({
      rows: [{ a: 1 }],
      variantId: 'base',
      reduced: true,
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not fall back on permission errors', async () => {
    const run = vi.fn<RunQueryVariant>(async () => {
      throw new LoupeError('PERMISSION_DENIED', 'no');
    });
    await expect(runWithFallback(SCRIPT_DEPLOYMENTS_QUERY, run)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('throws the last error when every variant fails', async () => {
    await expect(
      runWithFallback(SCRIPT_DEPLOYMENTS_QUERY, async () => {
        throw new Error('boom');
      }),
    ).rejects.toMatchObject({ code: 'UNKNOWN' });
    await expect(
      runWithFallback({ id: 'automation.workflows', variants: [] }, fixtureRun),
    ).rejects.toMatchObject({
      code: 'QUERY_FAILED',
    });
  });
});

describe('loadAutomations', () => {
  it('combines scripts and workflows in execution-group order', async () => {
    const result = await loadAutomations('1234567-sb1', 'salesorder', fixtureRun, () => 42);
    expect(result).toMatchObject({
      accountId: '1234567-sb1',
      recordType: 'salesorder',
      complete: true,
      warnings: [],
      fetchedAt: 42,
    });
    expect(result.items.map((i) => i.kind)).toEqual([
      'client',
      'user_event',
      'user_event',
      'workflow_action',
      'workflow',
      'workflow',
    ]);
  });

  it('reports partial data when one query fails or uses reduced columns', async () => {
    const result = await loadAutomations('1', 'salesorder', async (q, v) => {
      if (q === 'automation.workflows') throw new LoupeError('PERMISSION_DENIED', 'no');
      if (v === 'full') throw new LoupeError('TABLE_UNAVAILABLE', 'x');
      return fixtureRun(q, v);
    });
    expect(result.complete).toBe(false);
    expect(result.warnings).toEqual([
      AUTOMATION_WARNINGS.reducedColumns,
      AUTOMATION_WARNINGS.workflowsUnavailable,
    ]);
    expect(result.items.every((i) => i.kind !== 'workflow')).toBe(true);
  });

  it('reports scripts unavailable and reduced workflow columns', async () => {
    const result = await loadAutomations('1', 'salesorder', async (q, v) => {
      if (q === 'automation.scriptDeployments') throw new LoupeError('PERMISSION_DENIED', 'no');
      if (v === 'full') throw new LoupeError('TABLE_UNAVAILABLE', 'x');
      return fixtureRun(q, v);
    });
    expect(result.warnings).toEqual([
      AUTOMATION_WARNINGS.scriptsUnavailable,
      AUTOMATION_WARNINGS.reducedColumns,
    ]);
    expect(result.items).toHaveLength(2);
  });

  it('throws when both queries fail', async () => {
    await expect(
      loadAutomations('1', 'salesorder', async () => {
        throw new LoupeError('PERMISSION_DENIED', 'no');
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});

describe('resolveQuerySql', () => {
  it('only resolves allow-listed queries and variants', () => {
    expect(resolveQuerySql(AUTOMATION_QUERIES, 'automation.workflows', 'base')).toContain(
      'FROM workflow',
    );
    expect(resolveQuerySql(AUTOMATION_QUERIES, 'automation.workflows', 'nope')).toBeUndefined();
    expect(resolveQuerySql(AUTOMATION_QUERIES, 'toString', 'full')).toBeUndefined();
    expect(resolveQuerySql(AUTOMATION_QUERIES, '__proto__', 'full')).toBeUndefined();
  });
});
