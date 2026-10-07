import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS } from '../../shared/storage/settings';
import { useAppStore } from '../../shared/store';
import { getConsoleLibraryStorage } from '../../shared/storage/consoleLibrary';
import { recordContext } from '../../test/adapters';
import { CommandPalette } from './CommandPalette';
import { parseNavigationCommand } from './commands';

it('builds only mapped same-account navigation URLs and rejects malformed targets', () => {
  expect(parseNavigationCommand('1234567-sb1', 'record salesorder 1001')?.url).toBe(
    recordContext().url,
  );
  expect(parseNavigationCommand('1234567-sb1', 'record transaction 1001')?.url).toContain(
    '/app/accounting/transactions/transaction.nl?id=1001',
  );
  expect(parseNavigationCommand('1234567-sb1', 'record customrecord 123 5')?.url).toContain(
    'rectype=123&id=5',
  );
  expect(parseNavigationCommand('1234567-sb1', 'SCRIPT 501')?.url).toContain(
    '/app/common/scripting/script.nl?id=501',
  );
  for (const input of [
    'script customscript_demo',
    'script -1',
    'script 501 extra',
    'record employee abc',
    'record unknown 5',
    'record customrecord bad 5',
    'record salesorder 1&c=other',
    'https://evil.test',
  ])
    expect(parseNavigationCommand('1234567-sb1', input)).toBeUndefined();
});
it('searches enabled features with keyboard selection and restores focus on close', async () => {
  useAppStore.setState({ settings: DEFAULT_SETTINGS, activeTab: 'settings' });
  const user = userEvent.setup();
  const close = vi.fn();
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const view = render(<CommandPalette context={null} onClose={close} />);
  const input = screen.getByRole('combobox', { name: 'Search commands' });
  expect(input).toHaveFocus();
  await user.type(input, 'restlet');
  expect(screen.getByRole('option')).toHaveTextContent('Open RESTlet Tester');
  await user.keyboard('{Enter}');
  expect(useAppStore.getState().activeTab).toBe('restlets');
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});
it('omits disabled feature commands and never offers account navigation without context', async () => {
  useAppStore.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, restletTester: false, suiteqlConsole: false },
    },
  });
  render(<CommandPalette context={null} onClose={vi.fn()} />);
  const user = userEvent.setup();
  await user.type(screen.getByRole('combobox'), 'restlet');
  expect(screen.queryByRole('option')).toBeNull();
  await user.clear(screen.getByRole('combobox'));
  await user.type(screen.getByRole('combobox'), 'script 501');
  expect(screen.queryByRole('option')).toBeNull();
});
it('opens validated record/script links and account-local snippets as drafts with variables', async () => {
  useAppStore.setState({ settings: DEFAULT_SETTINGS, consoleDraft: undefined });
  const store = getConsoleLibraryStorage();
  await store.update('1234567-sb1', (old) => ({
    ...old,
    snippets: [
      {
        id: 'palette-sample',
        name: 'Palette sample',
        description: '',
        tags: [],
        sql: 'SELECT id FROM transaction WHERE id = ?',
        variables: [{ name: 'id', type: 'number', value: '1001' }],
      },
    ],
  }));
  const close = vi.fn();
  const create = vi.spyOn(browser.tabs, 'create');
  const view = render(<CommandPalette context={recordContext()} onClose={close} />);
  const user = userEvent.setup();
  const input = screen.getByRole('combobox', { name: 'Search commands' });
  await screen.findByRole('option', { name: 'Open snippet: Palette sample' });
  await user.type(input, 'Palette sample');
  await user.keyboard('{Enter}');
  expect(useAppStore.getState().consoleDraft).toMatchObject({
    accountId: '1234567-sb1',
    variables: [{ name: 'id', type: 'number', value: '1001' }],
  });
  expect(useAppStore.getState().activeTab).toBe('console');
  await user.clear(input);
  await user.type(input, 'script 501');
  await user.keyboard('{Enter}');
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith({
      url: 'https://1234567-sb1.app.netsuite.com/app/common/scripting/script.nl?id=501',
    }),
  );
  view.unmount();
  render(
    <CommandPalette context={{ ...recordContext(), accountId: '7654321' }} onClose={vi.fn()} />,
  );
  await act(async () => {
    await store.load('7654321');
  });
  expect(screen.queryByRole('option', { name: 'Open snippet: Palette sample' })).toBeNull();
});
