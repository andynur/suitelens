import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SuiteLensError } from '../../netsuite/errors';
import type { ConsoleResult } from '../../netsuite/queries/console';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { RelatedRecords } from './RelatedRecords';
import { RelatedTransactions } from './RelatedTransactions';

it('loads on demand, renders real branching links and supports folding and refresh', async () => {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  const user = userEvent.setup();
  render(<RelatedTransactions adapter={adapter} context={recordContext()} />);
  expect(run).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Load related transactions' }));
  const tree = await screen.findByRole('region', { name: 'Transaction relationship tree' });
  for (const number of ['SO-FAKE-1001', 'IF-FAKE-1101', 'INV-FAKE-1201', 'PAY-FAKE-1301']) {
    expect(within(tree).getByRole('link', { name: `${number} ↗` })).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^https:\/\/1234567-sb1.app.netsuite.com\/app\/accounting\/transactions\/transaction.nl\?id=\d+$/,
      ),
    );
  }
  expect(within(tree).getAllByRole('link', { name: 'IF-FAKE-1101 ↗' })).toHaveLength(1);
  const root = tree.querySelector('summary')!;
  await user.click(root);
  await waitFor(() => expect(root.parentElement).not.toHaveAttribute('open'));
  expect(within(tree).getByRole('link', { name: 'SO-FAKE-1001 ↗' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Refresh related transactions' }));
  await waitFor(() => expect(run).toHaveBeenCalledTimes(6));
});

it('keeps payload inspection available when relationship tables are unavailable and supports retry', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockRejectedValueOnce(
    new SuiteLensError('TABLE_UNAVAILABLE', 'Missing table'),
  );
  const user = userEvent.setup();
  render(<RelatedRecords adapter={adapter} context={recordContext()} />);
  await user.click(screen.getByRole('button', { name: 'Load related transactions' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('region', { name: 'Transaction relationship tree' });
});

it('shows an empty state and warns about a partial read', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockResolvedValue({
    accountId: '1234567-sb1',
    rows: [],
    atLimit: true,
  });
  render(<RelatedTransactions adapter={adapter} context={recordContext()} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Load related transactions' }));
  await screen.findByText('No related transactions found');
  expect(screen.getByText(/Partial tree/)).toBeInTheDocument();
});

it('rejects navigation changes before dispatching a read', async () => {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  vi.spyOn(adapter, 'getPageContext').mockResolvedValue({ ...recordContext(), recordId: '999' });
  render(<RelatedTransactions adapter={adapter} context={recordContext()} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Load related transactions' }));
  await screen.findByRole('alert');
  expect(run).not.toHaveBeenCalled();
});

it('aborts account changes and discards late relationship data', async () => {
  const adapter = fixtureAdapter();
  let resolve!: (value: ConsoleResult) => void;
  let signal: AbortSignal | undefined;
  const run = vi.spyOn(adapter, 'runSuiteQL').mockImplementationOnce((_sql, options) => {
    signal = options.signal;
    return new Promise((r) => {
      resolve = r;
    });
  });
  const view = render(<RelatedRecords adapter={adapter} context={recordContext()} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Load related transactions' }));
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  view.rerender(
    <RelatedRecords
      adapter={adapter}
      context={{
        ...recordContext(),
        accountId: 'other',
        url: recordContext().url.replace('1234567', '7654321'),
      }}
    />,
  );
  expect(signal?.aborted).toBe(true);
  expect(screen.queryByRole('region', { name: 'Transaction relationship tree' })).toBeNull();
  await act(async () => resolve({ accountId: '1234567-sb1', rows: [], atLimit: false }));
  expect(screen.getByRole('button', { name: 'Load related transactions' })).toBeInTheDocument();
  expect(run).toHaveBeenCalledTimes(1);
});

it('does not offer transaction reads for entities or unsaved transactions', async () => {
  const adapter = fixtureAdapter();
  const view = render(
    <RelatedRecords
      adapter={adapter}
      context={{ ...recordContext(), recordType: 'customer', recordId: '2001' }}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Load related transactions' })).toBeNull();
  view.rerender(
    <RelatedRecords adapter={adapter} context={{ ...recordContext(), recordId: undefined }} />,
  );
  expect(screen.queryByRole('button', { name: 'Load related transactions' })).toBeNull();
});
