import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { mixedProgress } from '../../test/impactSummary';
import type { AutomationResult } from '../../netsuite/types';
import { SuiteLensError } from '../../netsuite/errors';
import { ScriptMetadata } from './ScriptMetadata';
import { readScriptMetadata, summarizeScriptMetadata } from './loadScriptMetadata';

const context = recordContext();
const metadata = (): AutomationResult => ({
  accountId: context.accountId,
  recordType: context.recordType,
  complete: false,
  fetchedAt: 100,
  warnings: ['reduced_columns'],
  items: [
    {
      kind: 'user_event',
      name: '<b>Validation</b>',
      internalId: '101',
      scriptFileId: '1',
      isInactive: false,
    },
    {
      kind: 'user_event',
      name: '<b>Validation</b>',
      internalId: '101',
      scriptFileId: '1',
      isInactive: false,
      deploymentInternalId: '201',
    },
    { kind: 'client', name: 'Unknown', internalId: '102', scriptFileId: '1' },
    {
      kind: 'client',
      name: 'Outside scan',
      internalId: '103',
      scriptFileId: '999',
      isInactive: true,
    },
    { kind: 'workflow', name: 'Workflow', internalId: '104', scriptFileId: '2', isInactive: false },
  ],
});

it('deduplicates deployments, retains missing activity and counts unmatched partial-hit files', () => {
  const progress = mixedProgress();
  const result = summarizeScriptMetadata(progress, metadata());
  expect(result.counts).toEqual({ enabled: 1, inactive: 0, unknown: 1 });
  expect(result.unmatched).toBe(1);
  expect(result.records).toHaveLength(2);
  const data = metadata();
  data.items[1]!.isInactive = true;
  data.items[2]!.isInactive = true;
  expect(summarizeScriptMetadata(progress, data).counts).toEqual({
    enabled: 0,
    inactive: 1,
    unknown: 1,
  });
  progress.results[0]!.hits = [];
  expect(summarizeScriptMetadata(progress, data)).toMatchObject({ records: [], unmatched: 1 });
});

it.each(['account', 'record', 'page', 'cancel'] as const)(
  'discards replies after %s changes',
  async (change) => {
    const adapter = fixtureAdapter();
    const abort = new AbortController();
    vi.spyOn(adapter, 'getAutomations').mockImplementation(async () => {
      if (change === 'cancel') abort.abort();
      else
        vi.spyOn(adapter, 'getPageContext').mockResolvedValue({
          ...context,
          ...(change === 'account'
            ? { accountId: 'other' }
            : change === 'record'
              ? { recordType: 'customer' }
              : { url: `${context.url}&changed=T` }),
        });
      return metadata();
    });
    await expect(readScriptMetadata(adapter, context, abort.signal)).rejects.toMatchObject({
      code: change === 'cancel' ? 'CANCELLED' : 'ACCOUNT_MISMATCH',
    });
  },
);

it.each(['accountId', 'recordType'] as const)('rejects mismatched response %s', async (field) => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'getAutomations').mockResolvedValue({ ...metadata(), [field]: 'other' });
  await expect(
    readScriptMetadata(adapter, context, new AbortController().signal),
  ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
});

it('loads explicitly, retries failures, renders escaped names and incomplete coverage', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi
    .spyOn(adapter, 'getAutomations')
    .mockRejectedValueOnce(new SuiteLensError('PERMISSION_DENIED', 'Denied'))
    .mockResolvedValue(metadata());
  render(
    <ScriptMetadata
      adapter={adapter}
      context={context}
      progress={mixedProgress()}
      disabled={false}
    />,
  );
  expect(read).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Load script metadata' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('<b>Validation</b>');
  expect(screen.getByText(/1 enabled · 0 inactive · 1 activity unknown/)).toBeVisible();
  expect(screen.getByText(/Matching script files without record metadata: 1/)).toBeVisible();
  expect(screen.getByText(/Automation metadata is incomplete/)).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('discards pending metadata when the adapter is replaced', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  let release!: (value: AutomationResult) => void;
  vi.spyOn(adapter, 'getAutomations').mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const props = { context, progress: mixedProgress(), disabled: false };
  const view = render(<ScriptMetadata adapter={adapter} {...props} />);
  await user.click(screen.getByRole('button', { name: 'Load script metadata' }));
  const replacement = fixtureAdapter();
  vi.spyOn(replacement, 'getAutomations').mockResolvedValue(metadata());
  view.rerender(<ScriptMetadata adapter={replacement} {...props} />);
  await act(async () => release(metadata()));
  expect(screen.queryByText('<b>Validation</b>')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Load script metadata' }));
  await screen.findByText('<b>Validation</b>');
});
