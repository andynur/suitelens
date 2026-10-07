import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { NetSuiteAdapter } from '../../../netsuite/adapter/NetSuiteAdapter';
import type { ExecutionLog } from '../../../netsuite/queries/logs';
import { useAppStore } from '../../../shared/store';
import { fixtureAdapter } from '../../../test/adapters';
import { buildExplainErrorRequest } from '../prompts/explainError';
import type { PayloadItem } from '../types';
import type { AiRunState } from '../useAiRequest';
import { ExplainError } from './ExplainError';

const mocks = vi.hoisted(() => ({
  keyStatus: 'ready' as 'loading' | 'none' | 'locked' | 'ready',
  state: { status: 'idle', items: [], text: '' } as AiRunState,
  build: undefined as unknown,
  preview: vi.fn(),
}));
vi.mock('../useAiKeyStatus', () => ({ useAiKeyStatus: () => mocks.keyStatus }));
vi.mock('../useAiRequest', () => ({
  useAiRequest: (build: unknown) => {
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
vi.mock('../guard/AiResponse', () => ({
  AiResponse: ({ run, title }: { run: { state: AiRunState }; title: string }) => (
    <div role="dialog" aria-label={title}>
      {run.state.status}
    </div>
  ),
}));

const log = (id: string, patch: Partial<ExecutionLog> = {}): ExecutionLog => ({
  id,
  loggedat: '2026-10-04 09:10:00',
  level: 'ERROR',
  title: 'Order lookup failed',
  detail: 'Record 1001 not found',
  scriptinternalid: '501',
  scriptid: 'customscript_orders',
  deploymentinternalid: null,
  deploymentid: null,
  ...patch,
});

beforeEach(() => {
  mocks.keyStatus = 'ready';
  mocks.state = { status: 'idle', items: [], text: '' };
  mocks.preview.mockReset();
});

it('opens the preview with the selected logs and their script metadata', async () => {
  const user = userEvent.setup();
  const onClear = vi.fn();
  render(
    <ExplainError
      adapter={fixtureAdapter()}
      groups={[[log('700'), log('701')], [log('705', { level: 'EMERGENCY', title: 'Down' })]]}
      onClear={onClear}
    />,
  );
  expect(screen.getByText('2 of 20 selected for AI')).toBeVisible();
  expect(
    screen.getByRole('dialog', { name: 'Explain Error: review what will be sent' }),
  ).toHaveTextContent('idle');
  await user.click(screen.getByRole('button', { name: 'Explain with AI' }));
  const items = mocks.preview.mock.calls[0]![0] as PayloadItem[];
  expect(items.map((item) => item.kind)).toEqual(['question', 'log', 'log', 'metadata']);
  expect(items[1]!.label).toBe('Log ERROR: Order lookup failed (2 occurrences)');
  expect(items[2]!.content).toContain('Level: EMERGENCY');
  expect(items[3]!.content).toContain('- customscript_orders, internal ID 501');
  expect(mocks.build).toBe(buildExplainErrorRequest);
  await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  expect(onClear).toHaveBeenCalled();
});

it('is disabled without a selection or while streaming', () => {
  const view = render(<ExplainError adapter={fixtureAdapter()} groups={[]} onClear={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Explain with AI' })).toBeDisabled();
  expect(
    screen.getByText('Select up to 20 log entries or groups to explain with AI.'),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
  mocks.state = { status: 'streaming', items: [], text: '' };
  view.rerender(
    <ExplainError adapter={fixtureAdapter()} groups={[[log('1')]]} onClear={vi.fn()} />,
  );
  expect(screen.getByRole('button', { name: 'Explain with AI' })).toBeDisabled();
});

it('needs a key on a live adapter and links to AI setup', async () => {
  const user = userEvent.setup();
  mocks.keyStatus = 'locked';
  const live = { ...fixtureAdapter(), kind: 'live' } as NetSuiteAdapter;
  render(<ExplainError adapter={live} groups={[[log('1')]]} onClear={vi.fn()} />);
  expect(screen.getByText(/Your saved key is locked/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Explain with AI' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Open AI setup' }));
  expect(useAppStore.getState()).toMatchObject({ aiOpen: true, aiSetupRequested: true });
});
