import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SuiteLensError } from '../../../netsuite/errors';
import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import { useAppStore } from '../../../shared/store';
import { fixtureAdapter, recordContext } from '../../../test/adapters';
import { buildExplainScriptRequest } from '../prompts/explainScript';
import type { PayloadItem } from '../types';
import type { AiRunState } from '../useAiRequest';
import { ExplainScript } from './ExplainScript';

const mocks = vi.hoisted(() => ({
  keyStatus: 'ready' as 'loading' | 'none' | 'locked' | 'ready',
  state: { status: 'idle', items: [], text: '' } as AiRunState,
  build: undefined as unknown,
  preview: vi.fn(),
  cancelPreview: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock('../useAiKeyStatus', () => ({ useAiKeyStatus: () => mocks.keyStatus }));
vi.mock('../useAiRequest', () => ({
  useAiRequest: (build: unknown) => {
    mocks.build = build;
    return {
      state: mocks.state,
      preview: mocks.preview,
      cancelPreview: mocks.cancelPreview,
      confirm: mocks.confirm,
      cancel: vi.fn(),
      reset: vi.fn(),
    };
  },
}));
vi.mock('../guard/AiResponse', () => ({
  AiResponse: ({ run, title }: { run: { state: AiRunState }; title: string }) => (
    <div role="dialog" aria-label={title}>
      {run.state.status}: {run.state.items.map((item) => item.label).join(' | ')}
    </div>
  ),
}));

const SOURCE = "define(['N/record'], (record) => ({ beforeSubmit() {} }));";

beforeEach(() => {
  mocks.keyStatus = 'ready';
  mocks.state = { status: 'idle', items: [], text: '' };
  mocks.preview.mockReset();
});

const sourceFor = (adapter: NetSuiteAdapter, fileId: string) => ({
  accountId: recordContext().accountId,
  fileId,
  source: 'script' as const,
  url: `https://${recordContext().accountId}.app.netsuite.com/core/media/media.nl?id=${fileId}`,
  content: SOURCE,
  adapter,
});

it('lists record scripts with a file, reads the source on click and opens the preview', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi.spyOn(adapter, 'readImpactSource').mockImplementation(async (request) => {
    const { adapter: _adapter, ...source } = sourceFor(adapter, request.fileId);
    return source;
  });
  render(<ExplainScript adapter={adapter} context={recordContext()} />);
  const select = await screen.findByLabelText('Script on this record type');
  expect(select).toHaveDisplayValue('SuiteLens SO Client Helpers · suitelens_so_cs.js');
  await user.selectOptions(select, '9001');
  expect(read).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Explain' }));
  await waitFor(() => expect(mocks.preview).toHaveBeenCalledTimes(1));
  expect(read).toHaveBeenCalledWith({
    accountId: recordContext().accountId,
    fileId: '9001',
    source: 'script',
  });
  const items = mocks.preview.mock.calls[0]![0] as PayloadItem[];
  expect(items.map((item) => item.kind)).toEqual(['question', 'script', 'metadata']);
  expect(items[1]).toMatchObject({
    label: `Script source: suitelens_so_ue.js (file ID 9001), ${SOURCE.length} characters`,
    content: SOURCE,
  });
  expect(items[2]!.content).toContain('Script ID: customscript_suitelens_so_ue');
  expect(items[2]!.content).toContain('Deployed on record type: salesorder');
  expect(mocks.build).toBe(buildExplainScriptRequest);
});

it('explains a manually entered File Cabinet file ID without metadata', async () => {
  const user = userEvent.setup();
  render(<ExplainScript adapter={fixtureAdapter()} context={recordContext()} />);
  await user.selectOptions(
    await screen.findByLabelText('Script on this record type'),
    'Other file (enter its ID)',
  );
  const button = screen.getByRole('button', { name: 'Explain' });
  await user.type(screen.getByLabelText('File Cabinet file ID'), 'abc');
  expect(button).toBeDisabled();
  await user.clear(screen.getByLabelText('File Cabinet file ID'));
  await user.type(screen.getByLabelText('File Cabinet file ID'), '501');
  await user.click(button);
  await waitFor(() => expect(mocks.preview).toHaveBeenCalledTimes(1));
  const items = mocks.preview.mock.calls[0]![0] as PayloadItem[];
  expect(items.map((item) => item.kind)).toEqual(['question', 'script']);
  expect(items[1]!.label).toMatch(/^Script source: file ID 501, /);
  expect(items[1]!.content).toContain('custbody_demo_flag');
});

it('shows read failures with a retry and keeps the preview closed', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi
    .spyOn(adapter, 'readImpactSource')
    .mockRejectedValue(new SuiteLensError('PERMISSION_DENIED', 'denied'));
  render(<ExplainScript adapter={adapter} context={recordContext()} />);
  await screen.findByLabelText('Script on this record type');
  await user.click(screen.getByRole('button', { name: 'Explain' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(mocks.preview).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
});

it('renders the run through AiResponse with the preview title', () => {
  mocks.state = {
    status: 'preview',
    items: [{ id: 'q', kind: 'question', label: 'Request', content: 'x' }],
    text: '',
  };
  render(
    <ExplainScript
      adapter={fixtureAdapter()}
      context={{ ...recordContext(), recordType: undefined }}
    />,
  );
  expect(
    screen.getByRole('dialog', { name: 'Explain Script: review what will be sent' }),
  ).toHaveTextContent('preview: Request');
  expect(screen.getByText(/Open a record to pick one of its scripts/)).toBeVisible();
});

it('asks for a key on a live adapter and opens AI setup, without reading NetSuite', async () => {
  const user = userEvent.setup();
  const base = fixtureAdapter();
  const automations = vi.spyOn(base, 'getAutomations');
  const live = { ...base, kind: 'live' } as NetSuiteAdapter;
  mocks.keyStatus = 'none';
  const view = render(<ExplainScript adapter={live} context={recordContext()} />);
  expect(screen.getByText('AI is not set up')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Explain' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Open AI setup' }));
  expect(useAppStore.getState()).toMatchObject({ aiOpen: true, aiSetupRequested: true });
  mocks.keyStatus = 'locked';
  view.rerender(<ExplainScript adapter={live} context={recordContext()} />);
  expect(screen.getByText(/Your saved key is locked/)).toBeVisible();
  expect(automations).not.toHaveBeenCalled();
});
