import { expect, it, vi } from 'vitest';
import rows from '../../../fixtures/suiteql/restlets.deployments.json';
import { fixtureAdapter } from '../../test/adapters';
import { isReadOnlyQuery } from './console';
import { loadRestletDeployments, mapRestletDeployments, RESTLET_DEPLOYMENTS_SQL } from './restlets';

it('maps multiple deployments per script, deduplicates and orders unavailable scripts last', () => {
  const items = mapRestletDeployments([...rows, rows[0]]);
  expect(items).toHaveLength(4);
  expect(items.map((item) => item.deploymentInternalId)).toEqual(['601', '602', '603', '604']);
  expect(items[0]).toMatchObject({ scriptInternalId: '501', deployed: true, inactive: false });
  expect(items[2]?.deployed).toBe(false);
  expect(items[3]?.inactive).toBe(true);
  expect(mapRestletDeployments([{ ...rows[0], scriptname: null, isdeployed: true }])[0]?.name).toBe(
    'customscript_demo_orders',
  );
});

it('rejects malformed columns, unrelated script types and conflicting deployment identities', () => {
  for (const bad of [
    null,
    {},
    { ...rows[0], scriptinternalid: '501?other=1' },
    { ...rows[0], scripttype: 'CLIENT' },
    { ...rows[0], isdeployed: 'unknown' },
  ])
    expect(() => mapRestletDeployments([bad])).toThrow('Unexpected RESTlet');
  expect(() => mapRestletDeployments([rows[0], { ...rows[0], scriptid: 'other' }])).toThrow(
    'Conflicting',
  );
});

it('reads the exact fixture through the adapter with an account and bounded SELECT', async () => {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  expect(isReadOnlyQuery(RESTLET_DEPLOYMENTS_SQL)).toBe(true);
  expect(await loadRestletDeployments(run, { accountId: '1234567-sb1' })).toMatchObject({
    items: expect.any(Array),
    limited: false,
  });
  expect(run).toHaveBeenCalledWith(RESTLET_DEPLOYMENTS_SQL, {
    accountId: '1234567-sb1',
    maxRows: 1000,
  });
});

it('rejects another account and cancellation and preserves partial-read metadata', async () => {
  const run = vi.fn().mockResolvedValue({ accountId: 'other', rows, atLimit: false });
  await expect(loadRestletDeployments(run, { accountId: '1234567-sb1' })).rejects.toMatchObject({
    code: 'ACCOUNT_MISMATCH',
  });
  const controller = new AbortController();
  controller.abort();
  run.mockClear();
  await expect(
    loadRestletDeployments(run, { accountId: '1234567-sb1', signal: controller.signal }),
  ).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(run).not.toHaveBeenCalled();
  run.mockResolvedValue({ accountId: '1234567-sb1', rows: [], atLimit: true });
  expect(await loadRestletDeployments(run, { accountId: '1234567-sb1' })).toEqual({
    items: [],
    limited: true,
  });
});
