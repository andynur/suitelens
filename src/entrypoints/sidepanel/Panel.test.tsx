import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { detectFromUrl } from '../../netsuite/context/detect';
import { DEFAULT_SETTINGS } from '../../shared/storage/settings';
import { useAppStore } from '../../shared/store';
import { fixtureAdapter } from '../../test/adapters';
import { Panel } from './Panel';

const setState = (adapter: NetSuiteAdapter, url: string | null) =>
  act(() => {
    useAppStore.setState({
      adapter,
      settings: DEFAULT_SETTINGS,
      settingsLoaded: true,
      context: url ? (detectFromUrl(url) ?? null) : null,
      contextStatus: 'ready',
      activeTab: 'record',
      gotoOpen: false,
    });
  });

describe('Panel', () => {
  beforeEach(() => {
    useAppStore.setState({ settings: DEFAULT_SETTINGS, activeTab: 'record', gotoOpen: false });
  });

  it('shows the "not on a NetSuite page" state', () => {
    setState(fixtureAdapter(), null);
    render(<Panel />);
    expect(screen.getByText('Not on a NetSuite page')).toBeInTheDocument();
  });

  it('shows the "not a record" state on list pages', () => {
    setState(
      fixtureAdapter(),
      'https://1234567.app.netsuite.com/app/accounting/transactions/transactionlist.nl',
    );
    render(<Panel />);
    expect(screen.getByText('This page is not a record')).toBeInTheDocument();
  });

  it('shows account, environment and record in the header', async () => {
    setState(
      fixtureAdapter(),
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    render(<Panel />);
    expect(screen.getByTestId('env-pill')).toHaveTextContent('Sandbox');
    expect(screen.getByText('salesorder #1001')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'memo' })).toBeInTheDocument();
  });

  it('hides tabs of disabled features and opens Quick Go-to', async () => {
    const user = userEvent.setup();
    setState(
      fixtureAdapter(),
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    act(() =>
      useAppStore.setState({
        settings: {
          ...DEFAULT_SETTINGS,
          features: { ...DEFAULT_SETTINGS.features, automationMap: false },
        },
      }),
    );
    render(<Panel />);
    expect(screen.queryByRole('tab', { name: 'Automation' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Go to record' }));
    expect(screen.getByRole('form', { name: 'Quick Go-to' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Internal ID' })).toHaveFocus();
  });
});
