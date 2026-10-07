import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../shared/store';
import { recordContext } from '../../test/adapters';
import { SettingsPanel } from './SettingsPanel';

vi.mock('./About', () => ({ About: () => null }));

const section = (name: string) => screen.getByRole('heading', { name }).closest('details')!;

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ aiOpen: false, aiSetupRequested: undefined });
});

it('collapses long sections by default and shows their status', () => {
  render(<SettingsPanel context={recordContext()} />);
  expect(section('Appearance')).toHaveAttribute('open');
  expect(section('This account')).toHaveAttribute('open');
  expect(section('Features')).not.toHaveAttribute('open');
  expect(section('Features').querySelector('summary')!.textContent).toMatch(/\d+ of \d+ on/);
});

it('remembers an opened section in this browser', async () => {
  const view = render(<SettingsPanel context={recordContext()} />);
  await userEvent.click(screen.getByRole('heading', { name: 'Features' }));
  expect(section('Features')).toHaveAttribute('open');
  view.unmount();
  render(<SettingsPanel context={recordContext()} />);
  expect(section('Features')).toHaveAttribute('open');
});

it('sends AI setup to the AI Assistant drawer instead of a second form', async () => {
  render(<SettingsPanel context={recordContext()} />);
  expect(screen.queryByLabelText('Provider')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Open AI setup' }));
  expect(useAppStore.getState()).toMatchObject({ aiOpen: true, aiSetupRequested: true });
});
