import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../shared/store';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { DocumentationGenerator } from './DocumentationGenerator';

beforeEach(() => {
  const settings = useAppStore.getState().settings;
  useAppStore.getState().setSettings({
    ...settings,
    features: { ...settings.features, documentationGenerator: true },
  });
});

it('offers the as-built document and the AI agent context as presets', async () => {
  const user = userEvent.setup();
  render(<DocumentationGenerator adapter={fixtureAdapter()} context={recordContext()} />);
  expect(screen.getByRole('radio', { name: 'As-built document' })).toBeChecked();
  await user.click(screen.getByRole('radio', { name: 'AI agent context' }));
  expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
});

it('generates a value-free draft with explicit gaps and clears it when the type changes', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const context = recordContext();
  render(<DocumentationGenerator adapter={adapter} context={context} />);
  await user.click(screen.getByRole('button', { name: 'Generate preview' }));
  const preview = await screen.findByLabelText('As-built preview');
  expect(preview.textContent).toContain('As-built draft: salesorder');
  expect(preview.textContent).toContain('custbody_suitelens_priority');
  expect(preview.textContent).toContain('customscript_suitelens_so_ue');
  expect(preview.textContent).toContain('Forms/layouts: not checked');
  expect(preview.textContent).toContain('Execution order: not verified');
  expect(preview.textContent).not.toContain(context.accountId);
  const raw = await adapter.getRecordFields({ recordType: 'salesorder', id: context.recordId });
  for (const field of [...raw.fields, ...raw.sublists.flatMap((s) => s.fields)])
    if (field.value && field.value.length > 3 && field.value !== field.label)
      expect(preview.textContent).not.toContain(field.value);
  await user.clear(screen.getByRole('textbox', { name: 'Record type' }));
  expect(screen.queryByLabelText('As-built preview')).not.toBeInTheDocument();
  await user.type(screen.getByRole('textbox', { name: 'Record type' }), 'bad type');
  expect(screen.getByRole('button', { name: 'Generate preview' })).toBeDisabled();
});

it('discards a cancelled late field read and hides a previous account draft', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const context = recordContext();
  const raw = await adapter.getRecordFields({ recordType: 'salesorder', id: context.recordId });
  let resolve!: (value: typeof raw) => void;
  const read = vi.spyOn(adapter, 'getRecordFields').mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const { rerender } = render(<DocumentationGenerator adapter={adapter} context={context} />);
  await user.click(screen.getByRole('button', { name: 'Generate preview' }));
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await act(async () => {
    resolve(raw);
  });
  expect(screen.queryByLabelText('As-built preview')).not.toBeInTheDocument();
  read.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Generate preview' }));
  await screen.findByLabelText('As-built preview');
  rerender(
    <DocumentationGenerator adapter={adapter} context={{ ...context, accountId: 'other' }} />,
  );
  expect(screen.queryByLabelText('As-built preview')).not.toBeInTheDocument();
});

it('provides retry after all metadata reads fail', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const spy = vi
    .spyOn(adapter, 'getRecordFields')
    .mockRejectedValue(new Error('Field read unavailable'));
  vi.spyOn(adapter, 'getAutomations').mockRejectedValue(new Error('unavailable'));
  vi.spyOn(adapter, 'runSuiteQL').mockRejectedValue(new Error('unavailable'));
  render(<DocumentationGenerator adapter={adapter} context={recordContext()} />);
  await user.click(screen.getByRole('button', { name: 'Generate preview' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  spy.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByLabelText('As-built preview')).toBeVisible();
});
