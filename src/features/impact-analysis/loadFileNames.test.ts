import { expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { SuiteLensError } from '../../netsuite/errors';
import { readFileNames } from './loadFileNames';
import type { ImpactScanPlan } from './scan';

const context = recordContext();
const plan: ImpactScanPlan = {
  accountId: context.accountId,
  target: 'custbody_demo_flag',
  files: [
    { fileId: '501', source: 'script' },
    { fileId: '502', source: 'pdf-template' },
  ],
};
const signal = () => new AbortController().signal;

it('reads only supplied IDs through the existing bounded query without source reads', async () => {
  const adapter = fixtureAdapter();
  const query = vi.spyOn(adapter, 'runSuiteQL');
  const read = vi.spyOn(adapter, 'readImpactSource');
  expect(await readFileNames(adapter, plan, context.url, signal())).toEqual(
    new Map([['501', 'ue_demo_flag.js']]),
  );
  expect(query).toHaveBeenCalledOnce();
  expect(query.mock.calls[0]?.[1]).toMatchObject({
    accountId: context.accountId,
    params: ['501', '502'],
    maxRows: 2,
  });
  expect(read).not.toHaveBeenCalled();
});

it('batches a 500-file plan and discards malformed, blank and unrelated names', async () => {
  const adapter = fixtureAdapter();
  const query = vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (_sql, options) => ({
    accountId: context.accountId,
    atLimit: false,
    rows: [
      { id: options.params![0]!, name: 'observed.js' },
      { id: options.params![1]!, name: '   ' },
      { id: '9999', name: 'unplanned.js' },
      { id: options.params![2]!, name: 'x'.repeat(513) },
    ],
  }));
  const files = Array.from({ length: 500 }, (_, i) => ({
    fileId: String(i + 1),
    source: 'script' as const,
  }));
  const names = await readFileNames(adapter, { ...plan, files }, context.url, signal());
  expect(query).toHaveBeenCalledTimes(5);
  expect([...names.keys()]).toEqual(['1', '101', '201', '301', '401']);
  expect(
    query.mock.calls.every(
      ([, options]) => options.params?.length === 100 && options.maxRows === 100,
    ),
  ).toBe(true);
});

it('does not query for saved-search-only plans and rejects invalid file identities', async () => {
  const adapter = fixtureAdapter();
  const query = vi.spyOn(adapter, 'runSuiteQL');
  expect(
    await readFileNames(adapter, { ...plan, files: [], searches: ['503'] }, context.url, signal()),
  ).toEqual(new Map());
  await expect(
    readFileNames(
      adapter,
      { ...plan, files: [{ fileId: '1 OR 1=1', source: 'script' }] },
      context.url,
      signal(),
    ),
  ).rejects.toThrow();
  expect(query).not.toHaveBeenCalled();
});

it('fails closed on page/account changes and mismatched response accounts', async () => {
  const adapter = fixtureAdapter();
  const query = vi.spyOn(adapter, 'runSuiteQL');
  vi.spyOn(adapter, 'getPageContext').mockResolvedValueOnce({
    ...context,
    url: context.url + '&other=1',
  });
  await expect(readFileNames(adapter, plan, context.url, signal())).rejects.toMatchObject({
    code: 'ACCOUNT_MISMATCH',
  });
  expect(query).not.toHaveBeenCalled();
  query.mockResolvedValue({
    accountId: 'OTHER',
    rows: [{ id: 501, name: 'wrong.js' }],
    atLimit: false,
  });
  await expect(readFileNames(adapter, plan, context.url, signal())).rejects.toMatchObject({
    code: 'ACCOUNT_MISMATCH',
  });
  query.mockResolvedValue({ accountId: context.accountId, rows: [], atLimit: false });
  vi.spyOn(adapter, 'getPageContext')
    .mockResolvedValueOnce(context)
    .mockResolvedValueOnce({ ...context, accountId: 'OTHER' });
  await expect(readFileNames(adapter, plan, context.url, signal())).rejects.toMatchObject({
    code: 'ACCOUNT_MISMATCH',
  });
});

it('discards a cancelled late reply and propagates permission failures', async () => {
  const adapter = fixtureAdapter();
  const abort = new AbortController();
  vi.spyOn(adapter, 'runSuiteQL')
    .mockImplementationOnce(async () => {
      abort.abort();
      return { accountId: context.accountId, rows: [{ id: 501, name: 'late.js' }], atLimit: false };
    })
    .mockRejectedValue(new SuiteLensError('PERMISSION_DENIED', 'Denied'));
  await expect(readFileNames(adapter, plan, context.url, abort.signal)).rejects.toMatchObject({
    code: 'CANCELLED',
  });
  await expect(readFileNames(adapter, plan, context.url, signal())).rejects.toMatchObject({
    code: 'PERMISSION_DENIED',
  });
  await expect(readFileNames(adapter, plan, context.url, abort.signal)).rejects.toMatchObject({
    code: 'CANCELLED',
  });
});
