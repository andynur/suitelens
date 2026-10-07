import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { loadFixtureSet } from '../../netsuite/adapter/fixtureSet';
import { loadExecutionLogs, mapExecutionLogs } from '../../netsuite/queries/logs';
import { exportResults } from '../suiteql-console/export';
import { EMPTY_LOG_FILTERS, filterLogs, groupLogs, prettyLogDetail } from './logs';
import { LogViewer } from './LogViewer';
import type { ExecutionLog } from '../../netsuite/queries/logs';
import { useAppStore } from '../../shared/store';
import { updateAccountSettings } from '../../shared/storage/settings';

vi.mock('../ai/explain/ExplainError', () => ({
  ExplainError: ({ groups, onClear }: { groups: ExecutionLog[][]; onClear(): void }) => (
    <div data-testid="explain-error">
      <span>{groups.map((group) => group.map((item) => item.id).join('+')).join(',')}</span>
      <button onClick={onClear}>clear-ai</button>
    </div>
  ),
}));

it('maps fixture results, applies all filters, groups normalized errors and exports safe CSV', async () => {
  const data = await loadExecutionLogs(fixtureAdapter(), recordContext().accountId);
  const errors = filterLogs(data.items, {
    ...EMPTY_LOG_FILTERS,
    level: 'ERROR',
    text: 'not found',
    script: 'orders',
    from: '2026-10-04T09:10',
    to: '2026-10-04T09:12',
  });
  expect(errors).toHaveLength(3);
  expect(groupLogs(errors)[0]?.items).toHaveLength(3);
  expect(filterLogs(data.items, { ...EMPTY_LOG_FILTERS, script: 'worker' })).toHaveLength(2);
  expect(filterLogs(data.items, { ...EMPTY_LOG_FILTERS, deployment: '601' })).toHaveLength(0);
  expect(filterLogs(data.items, { ...EMPTY_LOG_FILTERS, from: '2026-10-05T00:00' })).toHaveLength(
    0,
  );
  expect(prettyLogDetail('{"a":1}')).toBe('{\n  "a": 1\n}');
  expect(prettyLogDetail('<img src=x>')).toBe('<img src=x>');
  expect(exportResults([{ detail: '=HYPERLINK("bad")' }], 'csv')).toContain("'=HYPERLINK");
  expect(() => mapExecutionLogs([{ ...data.items[0], level: 'TRACE' }])).toThrow(/Unexpected/);
  expect(() => mapExecutionLogs([data.items[0], data.items[0]])).toThrow(/Duplicate/);
});
it('validates the account and reports unavailable log tables', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockResolvedValue({
    accountId: 'other',
    rows: [],
    atLimit: false,
  });
  await expect(loadExecutionLogs(adapter, '1234567-sb1')).rejects.toThrow(/Account/);
  vi.spyOn(adapter, 'runSuiteQL').mockRejectedValue(new Error('ScriptNote unavailable'));
  render(<LogViewer adapter={adapter} context={recordContext()} />);
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
});
it('filters ERROR and keyword with grouped counts, detail links, JSON and no matches', async () => {
  const user = userEvent.setup();
  render(<LogViewer adapter={fixtureAdapter()} context={recordContext()} />);
  await screen.findByText('6 of 6 logs');
  await user.selectOptions(screen.getByLabelText('Log level', { exact: true }), 'ERROR');
  await user.type(screen.getByRole('searchbox'), 'not found');
  expect(screen.getByText('3 of 6 logs')).toBeVisible();
  await user.click(screen.getByText(/3 occurrences/));
  expect(screen.getAllByLabelText('Log detail')).toHaveLength(3);
  expect(screen.getAllByRole('link', { name: 'Script #501 ↗' })).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.getByLabelText('Deployment name or ID')).toBeDisabled();
  expect(screen.queryByRole('link', { name: /Deployment #/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'About deployment information' }));
  expect(screen.getByText(/Deployment information is unavailable/)).toBeVisible();
  await user.selectOptions(screen.getByLabelText('Log level', { exact: true }), 'AUDIT');
  await user.clear(screen.getByRole('searchbox'));
  await user.click(
    screen.getByRole('list', { name: 'Execution log groups' }).querySelector('summary')!,
  );
  expect(screen.getByLabelText('Log detail')).toHaveTextContent('"status": "received"');
  await user.type(screen.getByRole('searchbox'), 'missing');
  expect(screen.getByText('No logs match these filters.')).toBeVisible();
});
it('waits at least 30 seconds between settled reads, stops on unmount and ignores stale responses', async () => {
  vi.useFakeTimers();
  try {
    const adapter = fixtureAdapter();
    const run = vi.spyOn(adapter, 'runSuiteQL');
    const view = render(<LogViewer adapter={adapter} context={recordContext()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => screen.getByRole('button', { name: 'Filters' }).click());
    const select = screen.getByLabelText('Auto-refresh', { exact: true });
    await act(async () => {
      select.dispatchEvent(new Event('focus'));
      (select as HTMLSelectElement).value = '30';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29999);
    });
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(run).toHaveBeenCalledTimes(2);
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(run).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
it('loads and indexes 1,000 fixture rows within two seconds, using bounded pages', async () => {
  const raw = loadFixtureSet().suiteql['logs.execution']![0] as Record<string, unknown>;
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    ...raw,
    id: String(index + 1),
    title: `Error ${index}`,
  }));
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockResolvedValue({
    accountId: recordContext().accountId,
    rows,
    atLimit: true,
  });
  const started = performance.now();
  render(<LogViewer adapter={adapter} context={recordContext()} />);
  await screen.findByText('1,000 of 1,000 logs');
  await waitFor(() => expect(screen.getByText('Page 1 of 10')).toBeVisible());
  expect(performance.now() - started).toBeLessThan(2000);
  expect(screen.getByRole('list', { name: 'Execution log groups' }).children).toHaveLength(100);
});
it('selects log groups for Explain with AI, capped, and hides it when AI Assist is off', async () => {
  const user = userEvent.setup();
  const view = render(<LogViewer adapter={fixtureAdapter()} context={recordContext()} />);
  await screen.findByText('6 of 6 logs');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Select for AI' }));
  const explain = screen.getByTestId('explain-error');
  expect(explain).toHaveTextContent(/^clear-ai$/);
  await user.click(screen.getByRole('checkbox', { name: 'Select "Order lookup failed" for AI' }));
  await user.click(screen.getByRole('checkbox', { name: 'Select "System failure" for AI' }));
  expect(explain).toHaveTextContent('700+701+702,705');
  await user.click(screen.getByRole('checkbox', { name: 'Select "System failure" for AI' }));
  expect(explain).toHaveTextContent(/^700\+701\+702clear-ai$/);
  await user.click(screen.getByRole('button', { name: 'clear-ai' }));
  expect(
    screen.getByRole('checkbox', { name: 'Select "Order lookup failed" for AI' }),
  ).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'Select "Order lookup failed" for AI' }));
  await user.click(screen.getByRole('button', { name: 'Group similar errors' }));
  expect(explain).toHaveTextContent(/^clear-ai$/);
  expect(screen.getAllByRole('checkbox')).toHaveLength(6);

  const features = useAppStore.getState().settings.features;
  try {
    useAppStore.getState().setSettings({
      ...useAppStore.getState().settings,
      features: { ...features, aiAssist: false },
    });
    view.rerender(<LogViewer adapter={fixtureAdapter()} context={recordContext()} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('explain-error')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select for AI' })).not.toBeInTheDocument();
  } finally {
    useAppStore.getState().setSettings({ ...useAppStore.getState().settings, features });
  }
});
it('caps the AI selection at 20 groups', async () => {
  const raw = loadFixtureSet().suiteql['logs.execution']![0] as Record<string, unknown>;
  const rows = Array.from({ length: 25 }, (_, index) => ({
    ...raw,
    id: String(index + 1),
    title: `Error ${index}`,
    detail: `Distinct ${'x'.repeat(index + 1)}`,
  }));
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockResolvedValue({
    accountId: recordContext().accountId,
    rows,
    atLimit: false,
  });
  const user = userEvent.setup();
  render(<LogViewer adapter={adapter} context={recordContext()} />);
  await screen.findByText('25 of 25 logs');
  await user.click(screen.getByRole('button', { name: 'Select for AI' }));
  const boxes = screen.getAllByRole('checkbox');
  for (const box of boxes.slice(0, 20)) await user.click(box);
  expect(boxes[20]).toBeDisabled();
  expect(boxes[0]).toBeEnabled();
  expect(screen.getByTestId('explain-error').textContent?.split(',')).toHaveLength(20);
});

it('shows relative times only after the account log time zone is set', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<LogViewer adapter={fixtureAdapter()} context={recordContext()} />);
  const group = (await screen.findAllByText('customscript_orders'))[0]!;
  expect(group.closest('p')!.textContent).not.toMatch(/ago|yesterday|tomorrow|\bin \d/);
  unmount();

  await updateAccountSettings(recordContext().accountId, { logTimeZone: 'UTC' });
  render(<LogViewer adapter={fixtureAdapter()} context={recordContext()} />);
  await waitFor(async () =>
    expect(
      (await screen.findAllByText('customscript_orders'))[0]!.closest('p')!.textContent,
    ).toMatch(/ago|yesterday|tomorrow|\bin \d/),
  );
  await user.click((await screen.findAllByText('customscript_orders'))[0]!);
  expect(
    screen.getAllByText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \(.+\) · #\d+$/)[0],
  ).toBeTruthy();
  await updateAccountSettings(recordContext().accountId, { logTimeZone: undefined });
});
