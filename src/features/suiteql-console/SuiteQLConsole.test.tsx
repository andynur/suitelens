import { useAppStore } from '../../shared/store';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { fixtureAdapter } from '../../test/adapters';
import type { ConsoleResult } from '../../netsuite/queries/console';
import { SuiteLensError } from '../../netsuite/errors';
import { SuiteQLConsole } from './SuiteQLConsole';

const state = vi.hoisted(() => ({ sql: 'SELECT id FROM transaction', selected: '', ready: false }));
vi.mock('../../shared/storage/queryWorkspace', () => ({
  MAX_QUERY_TABS: 20,
  MAX_QUERY_LENGTH: 100_000,
  getQueryWorkspaceStorage: () => storage,
}));
const storage = {
  load: vi.fn(async () => ({
    activeId: 'a',
    tabs: [{ id: 'a', name: 'Query 1', sql: state.sql }],
  })),
  save: vi.fn(async () => {}),
};
vi.mock('./SqlEditor', () => ({
  SqlEditor: ({
    onReady,
    onRun,
    onSelectionChange,
  }: {
    onReady: (view: unknown) => void;
    onRun: () => void;
    onSelectionChange: (selected: boolean) => void;
  }) => {
    useEffect(() => {
      onReady({
        state: {
          doc: { toString: () => state.sql },
          selection: { main: { from: 0, to: 1 } },
          sliceDoc: () => state.selected,
        },
      });
      state.ready = true;
      onSelectionChange(Boolean(state.selected));
      return () => {
        state.ready = false;
        onReady(undefined);
      };
      // Stable fake editor; real CodeMirror selection and keymaps are covered by fixture E2E.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <button onClick={onRun}>Editor shortcut</button>;
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  useAppStore.setState({ consoleDraft: undefined });
  state.sql = 'SELECT id FROM transaction';
  state.selected = '';
  vi.clearAllMocks();
});
const result = (id: number): ConsoleResult => ({
  accountId: '1234567-sb1',
  rows: [{ id }],
  atLimit: false,
});

async function open() {
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  const rendered = render(<SuiteQLConsole accountId="1234567-sb1" adapter={adapter} />);
  await screen.findByRole('button', { name: /^Run (query|selection)$/ });
  await waitFor(() => expect(state.ready).toBe(true));
  return { ...rendered, run };
}

describe('console execution lifecycle', () => {
  it('runs full SQL, selection, and shortcut with selection precedence', async () => {
    state.selected = 'SELECT id FROM transaction WHERE ROWNUM <= 10';
    const { run } = await open();
    run.mockResolvedValue(result(1));
    // With a selection the split button runs the selection; the full query is in its menu.
    fireEvent.click(screen.getByRole('button', { name: 'More run options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Run query' }));
    await screen.findByText(/1 row\b/);
    expect(run.mock.calls[0]?.[0]).toBe(state.sql);
    fireEvent.click(screen.getByRole('button', { name: 'Run selection' }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await screen.findByText(/1 row\b/);
    expect(run.mock.calls[1]?.[0]).toBe(state.selected);
    fireEvent.click(screen.getByRole('button', { name: 'Editor shortcut' }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(3));
    expect(run.mock.calls[2]?.[0]).toBe(state.selected);
  });
  it('cancels immediately, allows rerun and ignores a late success from the cancelled request', async () => {
    const { run } = await open();
    let finish!: (value: ConsoleResult) => void;
    run.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    run.mockResolvedValueOnce(result(2));
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    expect(screen.getByRole('button', { name: 'Run query' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Editor shortcut' }));
    expect(run).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(run.mock.calls[0]?.[1].signal?.aborted).toBe(true);
    expect(screen.getByText(/Query cancelled/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    await screen.findByText(/1 row\b/);
    await act(async () => finish(result(999)));
    expect(screen.getByRole('cell', { name: /^2/ })).toBeVisible();
    expect(screen.queryByText(/999/)).toBeNull();
  });
  it('aborts on query-tab change and unmount', async () => {
    const { run, unmount } = await open();
    run.mockImplementation(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    fireEvent.click(screen.getByRole('button', { name: 'New query' }));
    expect(run.mock.calls[0]?.[1].signal?.aborted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Query 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    unmount();
    expect(run.mock.calls[1]?.[1].signal?.aborted).toBe(true);
  });
  it('shows the original error and retry, and blocks multi-statement writes before the adapter', async () => {
    const { run } = await open();
    run.mockRejectedValueOnce(
      new SuiteLensError('TABLE_UNAVAILABLE', 'Failed', 'Unknown identifier: missing_column'),
    );
    run.mockResolvedValue(result(1));
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unknown identifier: missing_column',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText(/1 row\b/);
    state.sql = 'SELECT id FROM transaction; DELETE FROM transaction';
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    await screen.findByRole('alert');
    expect(run).toHaveBeenCalledTimes(2);
  });
});

it('opens a snippet while the console is mounted, retains parameters and does not execute it', async () => {
  const { run } = await open();
  act(() =>
    useAppStore.getState().setConsoleDraft({
      accountId: '1234567-sb1',
      sql: 'SELECT id FROM transaction WHERE id = ?',
      variables: [{ name: 'record', type: 'number', value: '1001' }],
    }),
  );
  await screen.findByRole('button', { name: 'Query 2' });
  expect(screen.getByRole('textbox', { name: 'Variable name 1' })).toHaveValue('record');
  expect(screen.getByRole('textbox', { name: 'Parameter value 1' })).toHaveValue('1001');
  expect(screen.getByRole('combobox', { name: 'Parameter type 1' })).toHaveValue('number');
  expect(run).not.toHaveBeenCalled();
  expect(useAppStore.getState().consoleDraft).toBeUndefined();
});
it('keeps all drafts at the tab limit and waits for an available slot', async () => {
  const tabs = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    name: `Query ${index + 1}`,
    sql: 'SELECT id FROM transaction',
  }));
  storage.load.mockResolvedValueOnce({ activeId: '0', tabs });
  await open();
  act(() =>
    useAppStore.getState().setConsoleDraft({
      accountId: '1234567-sb1',
      sql: 'SELECT id FROM transaction WHERE id = 1001',
    }),
  );
  await screen.findByText(
    'Close a query tab to open the pending snippet. All 20 query tabs are in use.',
  );
  expect(storage.save).not.toHaveBeenCalled();
  expect(useAppStore.getState().consoleDraft?.sql).toContain('1001');
  fireEvent.click(screen.getByRole('button', { name: 'Close query' }));
  await waitFor(() => expect(useAppStore.getState().consoleDraft).toBeUndefined());
  expect(storage.save).toHaveBeenLastCalledWith(
    '1234567-sb1',
    expect.objectContaining({
      tabs: expect.arrayContaining([
        expect.objectContaining({ sql: 'SELECT id FROM transaction WHERE id = 1001' }),
      ]),
    }),
  );
});
it('does not consume snippets from a different account', async () => {
  await open();
  act(() =>
    useAppStore
      .getState()
      .setConsoleDraft({ accountId: 'other', sql: 'SELECT id FROM transaction' }),
  );
  expect(screen.queryByRole('button', { name: 'Query 2' })).toBeNull();
  expect(storage.save).not.toHaveBeenCalled();
});
