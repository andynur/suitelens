import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SuiteLensError } from '../../netsuite/errors';
import type { ConsoleResult } from '../../netsuite/queries/console';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { RestletTester } from './RestletTester';

it('lists deployments with highlighted literal search, metadata links and refresh', async () => {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  const user = userEvent.setup();
  render(<RestletTester adapter={adapter} context={recordContext()} />);
  await screen.findByText('4 of 4 deployments');
  expect(screen.getByRole('link', { name: 'Deployment #601 ↗' })).toHaveAttribute(
    'href',
    'https://1234567-sb1.app.netsuite.com/app/common/scripting/scriptrecord.nl?id=601',
  );
  expect(screen.getByText('Inactive script')).toBeVisible();
  expect(screen.getByText('Not deployed')).toBeVisible();
  expect(screen.getByText('TESTING')).toBeVisible();
  const search = screen.getByRole('searchbox');
  await user.type(search, 'ORDERS_TEST');
  expect(screen.getByText('1 of 4 deployments')).toBeVisible();
  expect(document.querySelector('mark')).toHaveTextContent('orders_test');
  await user.clear(search);
  await user.type(search, 'missing');
  expect(screen.getByText('No deployments match your search.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  await screen.findByText('0 of 4 deployments');
});

it('shows loading, errors and retry, then empty/limited results', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL')
    .mockRejectedValueOnce(new SuiteLensError('PERMISSION_DENIED', 'Denied'))
    .mockResolvedValueOnce({ accountId: '1234567-sb1', rows: [], atLimit: true });
  render(<RestletTester adapter={adapter} context={recordContext()} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  await screen.findByRole('alert');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('No RESTlet deployments found');
  expect(screen.getByText(/Showing the first 1,000/)).toBeVisible();
});

it('blocks changed targets before a read', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'getPageContext').mockResolvedValue({
    ...recordContext(),
    accountId: '7654321',
  });
  const run = vi.spyOn(adapter, 'runSuiteQL');
  render(<RestletTester adapter={adapter} context={recordContext()} />);
  await screen.findByRole('alert');
  expect(run).not.toHaveBeenCalled();
});

it('aborts pending reads on account change and ignores late results', async () => {
  const adapter = fixtureAdapter();
  let resolve!: (result: ConsoleResult) => void;
  const run = vi.spyOn(adapter, 'runSuiteQL').mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = render(<RestletTester adapter={adapter} context={recordContext()} />);
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  const signal = run.mock.calls[0]![1].signal;
  view.rerender(
    <RestletTester adapter={adapter} context={{ ...recordContext(), accountId: '7654321' }} />,
  );
  expect(signal?.aborted).toBe(true);
  await screen.findByRole('alert');
  await act(async () => resolve({ accountId: '1234567-sb1', rows: [], atLimit: false }));
  expect(screen.queryByText('No RESTlet deployments found')).not.toBeInTheDocument();
});

it('rejects navigation that occurs while the adapter read is pending', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'getPageContext')
    .mockResolvedValueOnce(recordContext())
    .mockResolvedValueOnce({ ...recordContext(), url: recordContext().url + '&changed=T' });
  render(<RestletTester adapter={adapter} context={recordContext()} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});
