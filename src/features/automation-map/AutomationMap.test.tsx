import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMetadataCache } from '../../shared/storage/cache';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { SO_URL } from '../../test/fixtures';
import { useAppStore } from '../../shared/store';
import { AutomationMap } from './AutomationMap';

describe('AutomationMap', () => {
  beforeEach(() => getMetadataCache().clearAll());

  it('lists client, user event, workflow action scripts and workflows in order', async () => {
    render(<AutomationMap adapter={fixtureAdapter()} context={recordContext()} />);
    const groups = await screen.findAllByRole('region');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
      'Client scripts',
      'User Event scripts (beforeLoad → beforeSubmit → afterSubmit)',
      'Workflow Action scripts',
      'Workflows',
    ]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'About execution order' }));
    expect(screen.getByText(/Order is approximate/)).toBeInTheDocument();
    const ue = within(groups[1]!);
    expect(ue.getByText('customdeploy_suitelens_so_ue')).toBeInTheDocument();
    expect(ue.getByText('USERINTERFACE, WEBSERVICES, CSVIMPORT')).toBeInTheDocument();
    expect(ue.getByText('Not deployed')).toBeInTheDocument();
    // A deployment set to all contexts reads "All contexts", not a list of 36 names.
    const client = within(groups[0]!);
    expect(client.getByText('All contexts')).toBeInTheDocument();
    expect(client.queryByText(/ADVANCEDREVREC/)).toBeNull();
    const scriptLink = ue.getAllByRole('link', { name: /Script/ })[0];
    expect(scriptLink).toHaveAttribute(
      'href',
      'https://1234567-sb1.app.netsuite.com/app/common/scripting/script.nl?id=101',
    );
  });

  it('hands unique script file IDs to Impact as prefill only', async () => {
    const user = userEvent.setup();
    const onWhereUsed = vi.fn();
    const adapter = fixtureAdapter();
    const read = vi.spyOn(adapter, 'readImpactSource');
    render(<AutomationMap adapter={adapter} context={recordContext()} onWhereUsed={onWhereUsed} />);
    await screen.findAllByRole('region');
    await user.click(screen.getByRole('button', { name: /^Scan in Impact \(\d+ files?\)$/ }));
    const [identifier, files] = onWhereUsed.mock.calls[0]!;
    expect(identifier).toBe('');
    expect(files).toEqual(expect.arrayContaining(['script:9001', 'script:9002']));
    expect(new Set(files).size).toBe(files.length);
    await user.click(screen.getAllByRole('button', { name: /^More actions for / })[0]!);
    await user.click(screen.getByRole('menuitem', { name: /^Add file to Impact/ }));
    expect(onWhereUsed.mock.calls[1]![1]).toHaveLength(1);
    expect(read).not.toHaveBeenCalled();
  });

  it('shows status lozenges only for exceptions and filters by text, state and type', async () => {
    const user = userEvent.setup();
    render(<AutomationMap adapter={fixtureAdapter()} context={recordContext()} />);
    await screen.findAllByRole('region');
    expect(screen.queryByText(/^released$/i)).toBeNull();

    const cards = () => document.querySelectorAll('li[data-automation-id]').length;
    const total = cards();
    await user.click(screen.getByRole('button', { name: 'Deployed only' }));
    await waitFor(() => expect(screen.queryByText('Not deployed')).toBeNull());
    expect(cards()).toBeLessThan(total);
    await user.click(screen.getByRole('button', { name: 'Deployed only' }));

    await user.click(screen.getByRole('button', { name: /^Workflows/ }));
    await waitFor(() =>
      expect(screen.getAllByRole('region').map((g) => g.getAttribute('aria-label'))).toEqual([
        'Workflows',
      ]),
    );
    await user.click(screen.getByRole('button', { name: /^Workflows/ }));

    await user.type(screen.getByRole('searchbox'), 'zzz-no-match');
    expect(await screen.findByText('No automations match the filter.')).toBeInTheDocument();
  });

  it('explains likely causes when the query fails', async () => {
    const adapter = fixtureAdapter(SO_URL, { failAutomations: 'PERMISSION_DENIED' });
    render(<AutomationMap adapter={adapter} context={recordContext()} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your NetSuite role cannot read this data');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows an empty state when nothing is deployed', async () => {
    const url = 'https://1234567-sb1.app.netsuite.com/app/common/entity/vendor.nl?id=1';
    render(<AutomationMap adapter={fixtureAdapter(url)} context={recordContext(url)} />);
    expect(
      await screen.findByText(/No client, user event or workflow automation/),
    ).toBeInTheDocument();
  });

  it('opens and marks the card a Logs handoff points to, once', async () => {
    useAppStore.getState().setAutomationFocus({
      accountId: recordContext().accountId,
      scriptId: 'customscript_suitelens_so_ue',
    });
    render(<AutomationMap adapter={fixtureAdapter()} context={recordContext()} />);
    await waitFor(() =>
      expect(document.querySelector('li[data-focused="true"]')).toHaveAttribute(
        'data-automation-id',
        'customscript_suitelens_so_ue',
      ),
    );
    expect(document.querySelector('li[data-focused="true"] details')).toHaveAttribute('open');
    expect(useAppStore.getState().automationFocus).toBeUndefined();
  });
});
