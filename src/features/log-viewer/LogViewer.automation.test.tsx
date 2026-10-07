import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useAppStore } from '../../shared/store';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { LogViewer } from './LogViewer';

vi.mock('../automation-map/load', () => ({
  loadAutomationsCached: vi.fn(async () => ({
    result: { items: [{ kind: 'userevent', scriptId: 'customscript_orders' }] },
  })),
}));

it('links logs of scripts on this record type to their Automation card', async () => {
  const user = userEvent.setup();
  render(<LogViewer adapter={fixtureAdapter()} context={recordContext()} />);
  const group = (await screen.findAllByText('customscript_orders'))[0]!;
  await user.click(group);
  await user.click((await screen.findAllByRole('button', { name: 'Show in Automation' }))[0]!);
  expect(useAppStore.getState().activeTab).toBe('automation');
  expect(useAppStore.getState().automationFocus).toEqual({
    accountId: recordContext().accountId,
    scriptId: 'customscript_orders',
  });
});
