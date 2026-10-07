import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import type { PageContext } from '../../../netsuite/types';
import type { ConsoleLibrary } from '../../../shared/storage/consoleLibrary';
import { useAppStore } from '../../../shared/store';
import { buildSuiteqlRequest, SUITEQL_FIXTURE_ANSWER } from '../prompts/suiteql';
import type { AiKeyStatus } from '../useAiKeyStatus';
import type { AiRun, AiRunState } from '../useAiRequest';
import { AskSuiteQL } from './AskSuiteQL';

const mocks = vi.hoisted(() => ({
  keyStatus: 'ready' as AiKeyStatus,
  state: { status: 'idle', items: [], text: '' } as AiRunState,
  preview: vi.fn(),
  build: undefined as unknown,
  library: { history: [], snippets: [] } as ConsoleLibrary,
  load: vi.fn(),
}));

vi.mock('../useAiKeyStatus', () => ({ useAiKeyStatus: () => mocks.keyStatus }));
vi.mock('../useAiRequest', () => ({
  useAiRequest: (build: unknown): AiRun => {
    mocks.build = build;
    return {
      state: mocks.state,
      preview: mocks.preview,
      cancelPreview: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
      reset: vi.fn(),
    };
  },
}));
vi.mock('../guard/AiResponse', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../guard/AiResponse')>();
  return {
    ...actual,
    AiResponse: ({
      run,
      title,
      renderCode,
    }: {
      run: AiRun;
      title: string;
      renderCode?: (code: string, lang: string) => ReactNode;
    }) => (
      <div data-testid="ai-response" data-title={title} data-status={run.state.status}>
        {actual
          .splitFencedBlocks(run.state.text)
          .map((block, i) =>
            block.type === 'code' ? (
              <div key={i}>{renderCode?.(block.code, block.lang)}</div>
            ) : (
              <p key={i}>{block.text}</p>
            ),
          )}
      </div>
    ),
  };
});
vi.mock('../../../shared/storage/consoleLibrary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/storage/consoleLibrary')>()),
  getConsoleLibraryStorage: () => ({ load: mocks.load }),
}));

const LIVE = { kind: 'live' } as NetSuiteAdapter;
const FIXTURE = { kind: 'fixture' } as NetSuiteAdapter;
const CONTEXT = { accountId: 'TSTDRV1' } as PageContext;
const INDEXED: ConsoleLibrary = {
  history: [],
  snippets: [],
  metadata: {
    next: 5,
    tables: [
      { name: 'item', columns: ['id', 'itemid'], source: 'observed' },
      {
        name: 'transaction',
        columns: ['id', 'tranid', 'trandate', 'type', 'entity', 'custbody_demo'],
        source: 'observed',
      },
      { name: 'customer', columns: ['id', 'entityid'], source: 'observed' },
    ],
  },
};

beforeEach(() => {
  mocks.keyStatus = 'ready';
  mocks.state = { status: 'idle', items: [], text: '' };
  mocks.preview.mockReset();
  mocks.library = INDEXED;
  mocks.load.mockReset().mockImplementation(() => Promise.resolve(mocks.library));
  useAppStore.setState({ activeTab: 'ai', consoleDraft: undefined });
});

it('asks for a key in AI setup when none is set up (live adapter)', async () => {
  mocks.keyStatus = 'none';
  render(<AskSuiteQL adapter={LIVE} context={CONTEXT} />);
  expect(screen.getByText('AI is not set up')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Open AI setup' }));
  expect(useAppStore.getState()).toMatchObject({ aiOpen: true, aiSetupRequested: true });
});

it('asks to unlock a locked key', () => {
  mocks.keyStatus = 'locked';
  render(<AskSuiteQL adapter={LIVE} context={CONTEXT} />);
  expect(screen.getByText(/Unlock it in AI setup/)).toBeInTheDocument();
});

it('works without a key in fixture mode and offers the built-in list when there is no index', async () => {
  mocks.keyStatus = 'none';
  mocks.library = { history: [], snippets: [] };
  render(<AskSuiteQL adapter={FIXTURE} context={CONTEXT} />);
  expect(await screen.findByText('No metadata index for this account yet')).toBeInTheDocument();
  expect(mocks.load).toHaveBeenCalledWith('TSTDRV1');
  await userEvent.type(screen.getByRole('textbox', { name: 'Question' }), 'latest invoices');
  await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
  const items = mocks.preview.mock.calls[0]![0] as { label: string; content: string }[];
  expect(items[1]!.content).toMatch(/^No metadata index/);
  expect(items[2]).toMatchObject({
    label: 'Common table (built-in): transaction (11 columns)',
  });
  await userEvent.click(screen.getByRole('button', { name: 'Open SuiteQL' }));
  expect(useAppStore.getState().activeTab).toBe('console');
  expect(useAppStore.getState().consoleDraft).toBeUndefined();
});

it('previews the question and an identifier-only schema summary; nothing is sent yet', async () => {
  render(<AskSuiteQL adapter={LIVE} context={CONTEXT} />);
  expect(
    await screen.findByText('Schema context: metadata index with 3 tables.'),
  ).toBeInTheDocument();
  const ask = screen.getByRole('button', { name: 'Ask' });
  expect(ask).toBeDisabled();
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Question' }),
    'List the 10 latest sales orders with customer names',
  );
  await userEvent.click(ask);
  expect(mocks.build).toBe(buildSuiteqlRequest);
  expect(mocks.preview).toHaveBeenCalledTimes(1);
  expect(mocks.preview.mock.calls[0]![0]).toEqual([
    {
      id: 'question',
      kind: 'question',
      label: 'Question',
      content: 'List the 10 latest sales orders with customer names',
      required: true,
    },
    {
      id: 'schema-notes',
      kind: 'schema',
      label: 'Schema notes',
      content: expect.stringMatching(/^Schema summary from the partial metadata index/),
    },
    {
      id: 'schema:transaction',
      kind: 'schema',
      label: 'Schema: transaction (6 columns)',
      content: 'transaction: id, tranid, trandate, type, entity, custbody_demo',
    },
    {
      id: 'schema:customer',
      kind: 'schema',
      label: 'Schema: customer (2 columns)',
      content: 'customer: id, entityid',
    },
  ]);
  expect(screen.getByTestId('ai-response')).toHaveAttribute(
    'data-title',
    'Send SuiteQL question to AI',
  );
});

it('validates the answer and opens it in the Console without running it', async () => {
  mocks.state = { status: 'done', items: [], text: SUITEQL_FIXTURE_ANSWER };
  render(<AskSuiteQL adapter={LIVE} context={CONTEXT} />);
  expect(
    await screen.findByText('All tables and columns were found in the metadata index.'),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Open in SuiteQL' }));
  const state = useAppStore.getState();
  expect(state.activeTab).toBe('console');
  expect(state.consoleDraft).toEqual({
    accountId: 'TSTDRV1',
    sql: expect.stringContaining("WHERE t.type = 'SalesOrd'"),
  });
});

it('flags columns missing from the index before running', async () => {
  mocks.state = {
    status: 'done',
    items: [],
    text: SUITEQL_FIXTURE_ANSWER.replace('t.trandate,', 't.trandate, t.salesrep_name,'),
  };
  render(<AskSuiteQL adapter={LIVE} context={CONTEXT} />);
  expect(await screen.findByText('Check before running')).toBeInTheDocument();
  expect(
    screen.getByText('Column transaction.salesrep_name is not in the metadata index.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open in SuiteQL' })).toBeInTheDocument();
});

it('does not offer statements other than one SELECT, and skips checks while streaming', async () => {
  mocks.state = { status: 'done', items: [], text: '```sql\nDELETE FROM transaction\n```' };
  const { unmount } = render(<AskSuiteQL adapter={LIVE} context={CONTEXT} />);
  expect(await screen.findByText('This is not a read-only SELECT statement.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open in SuiteQL' })).not.toBeInTheDocument();
  unmount();
  mocks.state = {
    status: 'streaming',
    items: [],
    text: '```sql\nSELECT t.nope FROM transaction t',
  };
  render(<AskSuiteQL adapter={LIVE} context={CONTEXT} />);
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Check before running')).not.toBeInTheDocument();
});
