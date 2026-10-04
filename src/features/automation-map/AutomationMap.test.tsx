import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getMetadataCache } from '../../shared/storage/cache';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { SO_URL } from '../../test/fixtures';
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
    expect(screen.getByText(/Order is approximate/)).toBeInTheDocument();
    const ue = within(groups[1]!);
    expect(ue.getByText('customdeploy_loupe_so_ue')).toBeInTheDocument();
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
});
