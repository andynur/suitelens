import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { useAppStore } from '../../shared/store';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { AiWorkbench } from './AiWorkbench';

const mocks = vi.hoisted(() => ({ keyStatus: 'none' as 'none' | 'locked' | 'ready' }));
vi.mock('./useAiKeyStatus', () => ({ useAiKeyStatus: () => mocks.keyStatus }));

const live = () => ({ ...fixtureAdapter(), kind: 'live' }) as NetSuiteAdapter;
const setup = () => screen.getByRole('heading', { name: 'AI setup' }).closest('details')!;

beforeEach(() => useAppStore.setState({ aiSetupRequested: undefined }));

it('opens AI setup in the drawer while no key is ready', () => {
  mocks.keyStatus = 'none';
  render(<AiWorkbench adapter={live()} context={recordContext()} />);
  expect(setup()).toHaveAttribute('open');
  expect(screen.getByText('Not set up')).toBeInTheDocument();
  expect(screen.getByLabelText('Provider')).toBeInTheDocument();
});

it('keeps AI setup closed with a status line once a key is ready', async () => {
  mocks.keyStatus = 'ready';
  render(<AiWorkbench adapter={live()} context={recordContext()} />);
  expect(setup()).not.toHaveAttribute('open');
  expect(screen.queryByLabelText('Provider')).toBeNull();
  await userEvent.click(screen.getByRole('heading', { name: 'AI setup' }));
  expect(setup()).toHaveAttribute('open');
  expect(screen.getByLabelText('Provider')).toBeInTheDocument();
});

it('opens AI setup once when another view asked for it', () => {
  mocks.keyStatus = 'ready';
  useAppStore.getState().openAiSetup();
  render(<AiWorkbench adapter={live()} context={recordContext()} />);
  expect(setup()).toHaveAttribute('open');
  expect(useAppStore.getState().aiSetupRequested).toBe(false);
});
