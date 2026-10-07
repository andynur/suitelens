import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { useAppStore } from '../../shared/store';
import { FieldExplorer } from './FieldExplorer';

describe('FieldExplorer', () => {
  it('shows body fields, the item sublist, and the data source', async () => {
    render(<FieldExplorer adapter={fixtureAdapter()} context={recordContext()} />);
    expect(await screen.findByRole('button', { name: 'memo' })).toBeInTheDocument();
    const sublists = screen.getByRole('region', { name: 'Sublists' });
    expect(within(sublists).getByText('item', { selector: 'summary span' })).toBeInTheDocument();
    expect(
      within(sublists).getByRole('button', { name: 'custcol_suitelens_batch' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Source: record XML + N/currentRecord' }),
    ).toBeInTheDocument();
  });

  it('searches by label or ID and filters custom fields', async () => {
    const user = userEvent.setup();
    render(<FieldExplorer adapter={fixtureAdapter()} context={recordContext()} />);
    await screen.findByRole('button', { name: 'memo' });
    await user.type(screen.getByRole('searchbox'), 'memo');
    const body = screen.getByRole('region', { name: 'Body fields' });
    const rowIds = () =>
      Array.from(body.querySelectorAll('tbody tr')).map((r) => r.getAttribute('data-field-id'));
    await waitFor(() => expect(rowIds()).toEqual(['memo']));
    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('button', { name: 'Custom' }));
    await waitFor(() => expect(rowIds().every((id) => id?.startsWith('cust'))).toBe(true));
  });

  it('marks only fields that need attention and wraps IDs at underscores', async () => {
    render(<FieldExplorer adapter={fixtureAdapter()} context={recordContext()} />);
    const id = await screen.findByRole('button', { name: 'custcol_suitelens_batch' });
    expect(id.querySelectorAll('wbr')).toHaveLength(2);
    expect(screen.queryByText('Standard')).toBeNull();
    expect(screen.queryByText('Custom', { selector: 'span' })).toBeNull();
  });

  it('asks the adapter to show a field on the page and explains a miss', async () => {
    const user = userEvent.setup();
    const adapter = fixtureAdapter();
    const highlight = vi.spyOn(adapter, 'highlightField').mockResolvedValue(false);
    render(<FieldExplorer adapter={adapter} context={recordContext()} />);
    const row = (await screen.findByRole('button', { name: 'memo' })).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /^Show .* on the page$/ }));
    expect(highlight).toHaveBeenCalledWith('memo');
    await waitFor(() =>
      expect(useAppStore.getState().toasts.at(-1)?.text).toBe('memo is not visible on this page.'),
    );
  });

  it('copies a field ID in the chosen format and shows a toast', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<FieldExplorer adapter={fixtureAdapter()} context={recordContext()} />);
    await user.click(await screen.findByRole('button', { name: 'Field list actions' }));
    await user.click(screen.getByRole('menuitem', { name: /Copy IDs as getValue snippet/ }));
    await user.click(await screen.findByRole('button', { name: 'memo' }));
    expect(writeText).toHaveBeenCalledWith("rec.getValue({ fieldId: 'memo' })");
    await waitFor(() => expect(useAppStore.getState().toasts.at(-1)?.text).toContain('Copied'));
  });

  it('folds fields that are not on the form and shows address line breaks', async () => {
    const base = fixtureAdapter();
    const adapter = {
      ...base,
      getRecordFields: async () => ({
        accountId: recordContext().accountId,
        recordType: 'salesorder',
        fields: [
          { id: 'entity', label: 'Customer', custom: false, sources: ['xml', 'dom'] as const },
          {
            id: 'billaddress',
            value: 'Fake Co.<br>1 Test Road',
            custom: false,
            sources: ['xml'] as const,
          },
        ].map((f) => ({ ...f, sources: [...f.sources] })),
        sublists: [],
        sources: ['xml', 'dom'] as ('xml' | 'dom')[],
        warnings: [],
        fetchedAt: 1,
      }),
    };
    render(<FieldExplorer adapter={adapter} context={recordContext()} />);
    await screen.findByRole('button', { name: 'entity' });
    const folded = screen.getByText('Not on this form (1)').closest('details');
    expect(folded).not.toHaveAttribute('open');
    expect(within(folded!).getByRole('button', { name: 'billaddress' })).toBeInTheDocument();
    expect(
      within(folded!).getByTitle('Fake Co.\n1 Test Road', { normalizer: (text) => text }),
    ).toHaveTextContent('Fake Co. 1 Test Road');

    await userEvent.setup().type(screen.getByRole('searchbox'), 'bill');
    await waitFor(() =>
      expect(screen.getByText('Not on this form (1)').closest('details')).toHaveAttribute('open'),
    );
  });

  it('explains errors without crashing', async () => {
    const adapter = fixtureAdapter();
    vi.spyOn(adapter, 'getRecordFields').mockRejectedValue(new Error('boom'));
    render(<FieldExplorer adapter={adapter} context={recordContext()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('An unexpected error occurred.');
  });

  it('rejects data from another account', async () => {
    const adapter = fixtureAdapter(
      'https://7654321.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001',
    );
    render(<FieldExplorer adapter={adapter} context={recordContext()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('changed to another account');
  });

  it('opens a one-field SuiteQL draft for custom body fields only', async () => {
    const user = userEvent.setup();
    render(<FieldExplorer adapter={fixtureAdapter()} context={recordContext()} />);
    await screen.findByRole('button', { name: 'memo' });
    expect(screen.queryByRole('button', { name: 'Query memo in SuiteQL' })).toBeNull();
    const custom = screen.getAllByRole('button', { name: /^Query custbody_\w+ in SuiteQL$/ })[0]!;
    const fieldId = custom.getAttribute('aria-label')!.split(' ')[1]!;
    await user.click(custom);
    expect(useAppStore.getState().activeTab).toBe('console');
    expect(useAppStore.getState().consoleDraft?.sql).toBe(
      `SELECT id, ${fieldId} FROM transaction WHERE id = 1001`,
    );
  });
});
