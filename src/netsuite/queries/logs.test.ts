import { expect, it, vi } from 'vitest';
import { fixtureAdapter } from '../../test/adapters';
import { loadFixtureSet } from '../adapter/fixtureSet';
import { EXECUTION_LOGS_SQL, loadExecutionLogs, mapExecutionLogs } from './logs';
import { SuiteLensError } from '../errors';
import scriptNoteSchema from '../../../fixtures/schema/scriptnote.json';
it('uses only ScriptNote fields observed in Records Catalog, including its actual primary key', () => {
  const fields = new Set(scriptNoteSchema.fields.map((field) => field.toLowerCase()));
  const references = [...EXECUTION_LOGS_SQL.matchAll(/\bn\.([a-z][a-z0-9_]*)/gi)];
  expect(references.length).toBeGreaterThan(0);
  for (const reference of references) expect(fields.has(reference[1]!.toLowerCase())).toBe(true);
});
it('maps the execution-log fixture and requests a bounded read in the supplied account', async () => {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  const controller = new AbortController();
  const logs = await loadExecutionLogs(adapter, '1234567-sb1', controller.signal);
  expect(logs.items).toHaveLength(6);
  expect(logs.items[0]).toMatchObject({
    id: '700',
    level: 'ERROR',
    scriptinternalid: '501',
    deploymentinternalid: null,
    deploymentid: null,
  });
  expect(run).toHaveBeenCalledWith(EXECUTION_LOGS_SQL, {
    accountId: '1234567-sb1',
    signal: controller.signal,
    maxRows: 1000,
  });
});
it('explains opaque SuiteQL failures without retrying or hiding permission errors', async () => {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  for (const code of ['QUERY_FAILED', 'TABLE_UNAVAILABLE', 'PERMISSION_DENIED'] as const) {
    run.mockRejectedValueOnce(new SuiteLensError(code, 'Query failed', 'Unexpected Error'));
    await expect(loadExecutionLogs(adapter, '1234567-sb1')).rejects.toMatchObject({
      code,
      detail: expect.stringContaining('Unexpected Error'),
    });
  }
  expect(run).toHaveBeenCalledTimes(3);
  run.mockRejectedValueOnce(new SuiteLensError('QUERY_FAILED', 'Query failed', 'Unexpected Error'));
  await expect(loadExecutionLogs(adapter, '1234567-sb1')).rejects.toMatchObject({
    detail: expect.stringContaining('Setup > SuiteScript (View or higher)'),
  });
});
it('rejects unknown columns and unsafe metadata IDs instead of making links', () => {
  const row = loadFixtureSet().suiteql['logs.execution']![0] as Record<string, unknown>;
  for (const patch of [
    { scriptinternalid: '../../script.nl?id=2' },
    { deploymentinternalid: '-1' },
    { loggedat: 'unknown' },
    { level: 'not a level' },
    { detail: undefined },
  ])
    expect(() => mapExecutionLogs([{ ...row, ...patch }])).toThrow(/Unexpected/);
  const nulls = mapExecutionLogs([
    { ...row, detail: null, title: null, scriptinternalid: null, deploymentinternalid: null },
  ]);
  expect(nulls[0]).toMatchObject({ detail: '', title: '', scriptinternalid: null });
});
it('discards a result after local cancellation', async () => {
  const controller = new AbortController();
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async () => {
    controller.abort();
    return { accountId: '1234567-sb1', rows: [], atLimit: false };
  });
  await expect(loadExecutionLogs(adapter, '1234567-sb1', controller.signal)).rejects.toThrow(
    /cancelled/,
  );
});
