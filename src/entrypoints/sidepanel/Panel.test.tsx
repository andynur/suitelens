import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
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
      settings: { ...DEFAULT_SETTINGS, onboardingComplete: true },
      settingsLoaded: true,
      context: url ? (detectFromUrl(url) ?? null) : null,
      contextStatus: 'ready',
      activeTab: 'record',
      gotoOpen: false,
    });
  });

describe('Panel', () => {
  it('shows the opt-in Docs tab and suppresses it in Safe mode', () => {
    const adapter = fixtureAdapter();
    setState(
      adapter,
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    act(() =>
      useAppStore.setState({
        settings: {
          ...DEFAULT_SETTINGS,
          onboardingComplete: true,
          features: { ...DEFAULT_SETTINGS.features, documentationGenerator: true },
        },
        activeTab: 'docs',
      }),
    );
    render(<Panel />);
    expect(screen.getByRole('tab', { name: 'Docs' })).toBeVisible();
    expect(screen.getByText('No document yet')).toBeVisible();
    act(() =>
      useAppStore.setState({ settings: { ...useAppStore.getState().settings, safeMode: true } }),
    );
    expect(screen.queryByRole('tab', { name: 'Docs' })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label') ?? tab.textContent),
    ).toEqual(['Settings']);
  });

  beforeEach(() => {
    vi.spyOn(browser.runtime, 'getManifest').mockReturnValue({
      manifest_version: 3,
      name: 'SuiteLens for NetSuite',
      version: '0.1.0',
    });
    useAppStore.setState({
      settings: { ...DEFAULT_SETTINGS, onboardingComplete: true },
      activeTab: 'record',
      gotoOpen: false,
    });
  });

  it('opens field and automation identifiers without scanning or supplying a file plan', async () => {
    const user = userEvent.setup();
    const adapter = fixtureAdapter();
    const read = vi.spyOn(adapter, 'readImpactSource');
    const url =
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';
    setState(adapter, url);
    render(<Panel />);
    await user.click(await screen.findByRole('button', { name: 'Check impact of memo' }));
    expect(screen.getByRole('tab', { name: 'Impact' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Field, script or saved search ID')).toHaveValue('memo');
    expect(screen.getByLabelText('File Cabinet files')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Scan or restore' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Record', pressed: false }));
    await user.click(screen.getByRole('tab', { name: 'Automation' }));
    await screen.findByText('customscript_suitelens_so_cs');
    // Card actions are in the expanded details.
    await user.click(screen.getByText('customscript_suitelens_so_cs'));
    await user.click(
      screen.getByRole('button', { name: 'Check impact of customscript_suitelens_so_cs' }),
    );
    expect(screen.getByLabelText('Field, script or saved search ID')).toHaveValue(
      'customscript_suitelens_so_cs',
    );
    expect(screen.getByLabelText('File Cabinet files')).toHaveValue('');
    expect(read).not.toHaveBeenCalled();
    act(() => useAppStore.setState({ adapter: fixtureAdapter() }));
    expect(screen.getByLabelText('Field, script or saved search ID')).toHaveValue('');
    act(() => useAppStore.setState({ context: detectFromUrl(url.replace('1234567', '7654321')) }));
    expect(screen.getByLabelText('Field, script or saved search ID')).toHaveValue('');
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await user.click(screen.getByRole('tab', { name: 'Impact' }));
    expect(screen.getByLabelText('Field, script or saved search ID')).toHaveValue('');
  });

  it('hides Impact shortcuts when Impact Analysis is disabled', async () => {
    const user = userEvent.setup();
    setState(
      fixtureAdapter(),
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    useAppStore.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        onboardingComplete: true,
        features: { ...DEFAULT_SETTINGS.features, impactAnalysis: false },
      },
    });
    render(<Panel />);
    await screen.findByRole('button', { name: 'memo' });
    expect(screen.queryByRole('button', { name: /^Check impact of / })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Automation' }));
    await screen.findByText('customscript_suitelens_so_cs');
    expect(document.querySelector('[aria-label^="Check impact of "]')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Impact' })).toBeNull();
  });

  it('shows only Settings in Safe mode and restores tabs when it is turned off', async () => {
    const user = userEvent.setup();
    setState(
      fixtureAdapter(),
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    act(() =>
      useAppStore.setState({
        settings: { ...DEFAULT_SETTINGS, onboardingComplete: true, safeMode: true },
      }),
    );
    render(<Panel />);
    expect(
      screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label') ?? tab.textContent),
    ).toEqual(['Settings']);
    expect(screen.queryByRole('button', { name: 'Go to…' })).toBeNull();
    expect(screen.getByText(/Safe mode is on/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Field Explorer/ })).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: /Safe mode/ }));
    expect(screen.getByRole('tab', { name: 'Fields' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commands' })).toBeInTheDocument();
  });

  it('shows the "not on a NetSuite page" state', () => {
    setState(fixtureAdapter(), null);
    render(<Panel />);
    expect(screen.getByText('Not on a NetSuite page')).toBeInTheDocument();
  });

  it('opens Home on list pages and explains empty Record tabs', async () => {
    const user = userEvent.setup();
    setState(
      fixtureAdapter(),
      'https://1234567.app.netsuite.com/app/accounting/transactions/transactionlist.nl',
    );
    render(<Panel />);
    expect(await screen.findByRole('heading', { name: 'Welcome to SuiteLens' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Open Fields' }));
    expect(screen.getByText('This page is not a record')).toBeInTheDocument();
    expect(
      screen.getByText(/Fields with IDs, types and values\. Why it is empty/),
    ).toBeInTheDocument();
  });

  it('switches between the Record and Tools groups and opens AI as a drawer', async () => {
    const user = userEvent.setup();
    setState(
      fixtureAdapter(),
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    render(<Panel />);
    await screen.findByRole('button', { name: 'memo' });
    expect(screen.getByRole('button', { name: 'Record' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByRole('tab', { name: 'SuiteQL' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Fields' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'AI Assistant' }));
    expect(screen.getByRole('complementary', { name: 'AI Assistant' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'SuiteQL' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Close AI Assistant' }));
    expect(screen.queryByRole('complementary', { name: 'AI Assistant' })).toBeNull();
    // The toggle sits in the group row (ADR 0053); choosing a group closes the drawer.
    const toggle = within(screen.getByRole('navigation', { name: 'Sections' })).getByRole(
      'button',
      { name: 'AI Assistant' },
    );
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Record' }));
    expect(screen.queryByRole('complementary', { name: 'AI Assistant' })).toBeNull();
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: 'AI Assistant' }),
    ).toBeNull();
  });

  it('shows account, environment and record in the header', async () => {
    setState(
      fixtureAdapter(),
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    render(<Panel />);
    expect(screen.getByTestId('env-pill')).toHaveTextContent('Sandbox');
    expect(screen.getByText(/^Sales Order/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy internal ID 1001' })).toHaveTextContent(
      '#1001',
    );
    expect(await screen.findByRole('button', { name: 'memo' })).toBeInTheDocument();
    // The Record tab's read also names the record and fills the summary strip.
    expect(await screen.findByRole('navigation', { name: 'Record summary' })).toHaveTextContent(
      /\d+ fields/,
    );
  });

  it('copies the record internal ID and opens the panel in a full tab from the header', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    const create = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as never);
    setState(
      fixtureAdapter(),
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    render(<Panel />);
    await user.click(screen.getByRole('button', { name: 'Copy internal ID 1001' }));
    expect(writeText).toHaveBeenCalledWith('1001');
    await user.click(screen.getByRole('button', { name: 'Open in full tab' }));
    await vi.waitFor(() =>
      expect(create).toHaveBeenCalledWith({ url: expect.stringContaining('/sidepanel.html') }),
    );
  });

  it('retains the record snapshot and filters across tabs until manual refresh', async () => {
    const user = userEvent.setup();
    const adapter = fixtureAdapter();
    const result = await adapter.getRecordFields({ recordType: 'salesorder', id: '1001' });
    const load = vi.spyOn(adapter, 'getRecordFields');
    setState(
      adapter,
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    render(<Panel />);
    await screen.findByRole('button', { name: 'memo' });
    await user.type(screen.getByRole('searchbox'), 'memo');

    for (const tab of ['Automation', 'Settings']) {
      await user.click(screen.getByRole('tab', { name: tab }));
      expect(screen.queryByRole('button', { name: 'memo' })).toBeNull();
      await user.click(screen.getByRole('tab', { name: 'Fields' }));
      expect(screen.getByRole('button', { name: 'memo' })).toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toHaveValue('memo');
    }
    expect(load).toHaveBeenCalledTimes(1);

    load.mockResolvedValue({
      ...result,
      fields: result.fields.map((field) =>
        field.id === 'memo' ? { ...field, value: 'Updated after refresh' } : field,
      ),
    });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Updated after refresh')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('searchbox')).toHaveValue('memo');
  });

  it('invalidates the retained snapshot when the record or account changes while hidden', async () => {
    const user = userEvent.setup();
    const firstUrl =
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';
    const adapter = fixtureAdapter(firstUrl);
    const result = await adapter.getRecordFields({ recordType: 'salesorder', id: '1001' });
    const load = vi.spyOn(adapter, 'getRecordFields').mockResolvedValue(result);
    setState(adapter, firstUrl);
    render(<Panel />);
    await screen.findByRole('button', { name: 'memo' });
    await user.type(screen.getByRole('searchbox'), 'memo');

    for (const url of [firstUrl.replace('1001', '1002'), firstUrl.replace('1234567', '7654321')]) {
      await user.click(screen.getByRole('tab', { name: 'Settings' }));
      const context = detectFromUrl(url)!;
      load.mockResolvedValue({
        ...result,
        accountId: context.accountId,
        recordId: context.recordId,
        fields: [{ id: 'new_field', value: url, custom: false, sources: ['xml'] }],
      });
      act(() => useAppStore.setState({ context }));
      await user.click(screen.getByRole('tab', { name: 'Fields' }));
      expect(await screen.findByRole('button', { name: 'new_field' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'memo' })).toBeNull();
      expect(screen.getByRole('searchbox')).toHaveValue('');
    }
    expect(load).toHaveBeenCalledTimes(3);
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
          onboardingComplete: true,
          features: { ...DEFAULT_SETTINGS.features, automationMap: false, commandPalette: false },
        },
      }),
    );
    render(<Panel />);
    expect(screen.queryByRole('tab', { name: 'Automation' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Go to…' }));
    expect(screen.getByRole('form', { name: 'Quick Go-to' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Internal ID' })).toHaveFocus();
  });

  it('toggles the command palette with Ctrl+K and closes it with Escape', async () => {
    const user = userEvent.setup();
    setState(
      fixtureAdapter(),
      'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    render(<Panel />);
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('region', { name: 'Commands' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Commands' })).toBeNull();
  });
});
