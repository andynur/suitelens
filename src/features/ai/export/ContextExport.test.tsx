import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../../test/adapters';
import { ContextExport } from './ContextExport';

const copy = vi.hoisted(() => vi.fn(async (_text: string, _message?: string) => true));
const download = vi.hoisted(() => vi.fn((_text: string, _name: string, _mime: string) => {}));
vi.mock('../../../shared/ui/clipboard', () => ({ copyWithToast: copy }));
vi.mock('../../../shared/ui/download', () => ({ downloadLocal: download }));

beforeEach(() => {
  copy.mockClear();
  download.mockClear();
});

it('generates the active record type and offers copy and download', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const ctx = recordContext();
  render(<ContextExport adapter={adapter} context={ctx} />);
  expect(screen.getByRole('textbox', { name: 'Record type' })).toHaveValue('salesorder');
  expect(screen.getByText('No export yet')).toBeVisible();

  await user.click(screen.getByRole('button', { name: 'Generate' }));
  const preview = await screen.findByLabelText('Markdown preview');
  expect(preview.textContent).toContain('`custbody_suitelens_priority`');
  expect(preview.textContent).not.toContain(ctx.accountId);
  expect(screen.getByText(/body fields \(4 custom\)/)).toBeVisible();
  expect(screen.getByText('Save as netsuite-context/salesorder.md in your project.')).toBeVisible();

  await user.click(screen.getByRole('button', { name: 'Copy' }));
  await user.click(screen.getByRole('menuitem', { name: 'Copy Markdown' }));
  expect(copy).toHaveBeenLastCalledWith(preview.textContent, 'Copied Markdown');
  await user.click(screen.getByRole('button', { name: 'Copy' }));
  await user.click(screen.getByRole('menuitem', { name: 'Copy JSON' }));
  expect(JSON.parse(copy.mock.lastCall![0])).toMatchObject({ recordType: 'salesorder' });
  await user.click(screen.getByRole('button', { name: 'Copy' }));
  await user.click(screen.getByRole('menuitem', { name: 'Copy agent snippet' }));
  expect(copy.mock.lastCall![0]).toContain('netsuite-context/salesorder.md');
  await user.click(screen.getByRole('button', { name: 'Download' }));
  await user.click(screen.getByRole('menuitem', { name: 'Download .md' }));
  expect(download).toHaveBeenLastCalledWith(
    preview.textContent,
    'salesorder.md',
    'text/markdown;charset=utf-8',
  );
  await user.click(screen.getByRole('button', { name: 'Download' }));
  await user.click(screen.getByRole('menuitem', { name: 'Download .json' }));
  expect(download.mock.lastCall![1]).toBe('salesorder.json');
});

it('validates a typed record type and explains when fields are not read', async () => {
  const user = userEvent.setup();
  render(<ContextExport adapter={fixtureAdapter()} context={recordContext()} />);
  const input = screen.getByRole('textbox', { name: 'Record type' });
  await user.clear(input);
  await user.type(input, 'Sales Order');
  expect(screen.getByText(/Enter a SuiteScript record type ID/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
  await user.clear(input);
  await user.type(input, 'customer');
  expect(screen.getByText(/Body and sublist fields require an open customer record/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Use active (salesorder)' }));
  expect(input).toHaveValue('salesorder');
});

it('shows an error panel with retry when nothing can be read', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'getRecordFields').mockRejectedValue(new Error('fields down'));
  vi.spyOn(adapter, 'getAutomations').mockRejectedValue(new Error('scripts down'));
  vi.spyOn(adapter, 'runSuiteQL').mockRejectedValue(new Error('query down'));
  render(<ContextExport adapter={adapter} context={recordContext()} />);
  await user.click(screen.getByRole('button', { name: 'Generate' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
});
