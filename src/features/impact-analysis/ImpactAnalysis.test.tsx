import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SuiteLensError } from '../../netsuite/errors';
import { createMetadataCache } from '../../shared/storage/cache';
import { getAccountSettings } from '../../shared/storage/settings';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { ImpactAnalysis } from './ImpactAnalysis';

let db = 0;
const cacheForTest = () => createMetadataCache({ dbName: `impact-ui-${++db}` });

it('plans page-linked search IDs explicitly, preserves files and retries only discovery', async () => {
  const user = userEvent.setup();
  const url = 'https://1234567-sb1.app.netsuite.com/app/common/search/searchlist.nl';
  const context = { ...recordContext(), url, recordType: undefined };
  const adapter = fixtureAdapter(url);
  const discovery = vi
    .spyOn(adapter, 'discoverImpactSavedSearches')
    .mockRejectedValueOnce(new SuiteLensError('NO_CONTENT_SCRIPT', 'Reload and retry.'));
  const definition = vi.spyOn(adapter, 'readImpactSavedSearch');
  const source = vi.spyOn(adapter, 'readImpactSource');
  render(<ImpactAnalysis adapter={adapter} context={context} cache={cacheForTest()} />);
  await fill(user, 'script:501');
  expect(discovery).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Add searches linked on this page' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('File Cabinet files')).toHaveValue('script:501');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Linked searches found: 1 · Added to draft: 1.');
  expect(screen.getByLabelText('File Cabinet files')).toHaveValue('script:501\nsaved-search:503');
  expect(definition).not.toHaveBeenCalled();
  expect(source).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Add searches linked on this page' }));
  await screen.findByText('Linked searches found: 1 · Added to draft: 0.');
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  expect(definition).toHaveBeenCalledTimes(1);
  expect(source).toHaveBeenCalledTimes(1);
});

it('loads manual file labels after the scan without rereading source and drops them after remount or plan edit', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi.spyOn(adapter, 'readImpactSource');
  const query = vi.spyOn(adapter, 'runSuiteQL');
  const cache = cacheForTest();
  const view = render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cache} />);
  await fill(user);
  expect(query).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  // Names and script metadata are read once the scan completes (ADR 0051), without source reads.
  await screen.findByText('ue_demo_flag.js');
  expect(screen.getAllByRole('region', { name: 'Matching script records' })).toHaveLength(1);
  expect(screen.getByText('File #502')).toBeVisible();
  expect(read).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole('button', { name: 'Reload file names' }));
  await screen.findByText('ue_demo_flag.js');
  expect(read).toHaveBeenCalledTimes(2);
  view.unmount();
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cache} />);
  await fill(user);
  expect(screen.queryByText('ue_demo_flag.js')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('ue_demo_flag.js');
  expect(read).toHaveBeenCalledTimes(2);
  await openOptions(user);
  await user.clear(screen.getByLabelText('File Cabinet files'));
  expect(screen.queryByText('ue_demo_flag.js')).not.toBeInTheDocument();
});

/** Options fold into a summary line after a scan; reopen them before editing. */
async function openOptions(user: ReturnType<typeof userEvent.setup>) {
  const button = screen.getByRole('button', { name: 'Scan options' });
  if (button.getAttribute('aria-expanded') !== 'true') await user.click(button);
}

/** The Coverage section below the results is collapsed by default. */
async function openCoverage(user: ReturnType<typeof userEvent.setup>) {
  const summary = screen.getByText('Coverage: what was checked');
  if (!summary.closest('details')!.open) await user.click(summary);
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  files = 'script:501\npdf-template:502',
) {
  await user.type(screen.getByLabelText('Field, script or saved search ID'), 'custbody_demo_flag');
  await user.type(screen.getByLabelText('File Cabinet files'), files);
}

it('validates file plans and restores positional results without reading again; refresh retries failures', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi.spyOn(adapter, 'readImpactSource');
  const cache = cacheForTest();
  const view = render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cache} />);
  expect(screen.getByRole('button', { name: 'Scan or restore' })).toBeDisabled();
  await fill(user, 'script:501\npdf-template:501');
  expect(screen.getByRole('button', { name: 'Scan or restore' })).toBeDisabled();
  await user.clear(screen.getByLabelText('File Cabinet files'));
  await user.type(
    screen.getByLabelText('File Cabinet files'),
    'script:501\npdf-template:502\nscript:999',
  );
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  expect(screen.getByText('3 of 3 sources processed')).toBeVisible();
  expect(screen.getAllByText(/possible reference/).length).toBeGreaterThan(1);
  expect(screen.getByText('Not checked')).toBeVisible();
  await openCoverage(user);
  expect(screen.getByText(/zero matches do not mean/)).toBeVisible();
  expect(screen.getByText(/Change risk cannot be determined/)).toBeVisible();
  expect(read).toHaveBeenCalledTimes(3);
  expect(screen.getByText('Code excerpt · line 5')).toBeVisible();
  await user.click(screen.getAllByText('Script dependencies')[0]!);
  expect(screen.getByText('N/record')).toBeVisible();
  await user.click(screen.getByText('Code excerpt · line 5'));
  expect(screen.getAllByText(/5:.*getValue/)[0]).toBeVisible();
  view.unmount();
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cache} />);
  await fill(user, 'script:501\npdf-template:502\nscript:999');
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  expect(read).toHaveBeenCalledTimes(3);
  expect(screen.queryByText('Code excerpt · line 5')).not.toBeInTheDocument();
  expect(screen.getByText(/Some excerpts are unavailable/)).toBeVisible();
  await user.click(screen.getAllByText('Script dependencies')[0]!);
  expect(screen.getAllByText(/Dependencies were not read/)[0]).toBeVisible();
  expect(screen.queryByText('N/record')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Rescan from source' }));
  await screen.findByText('Scan complete');
  expect(read).toHaveBeenCalledTimes(6);
  expect(screen.getByText('Code excerpt · line 5')).toBeVisible();
  await user.clear(screen.getByLabelText('Field, script or saved search ID'));
  expect(screen.queryByText('Scan complete')).not.toBeInTheDocument();
});

it('cancels a pending file, discards its late reply and resumes only unfinished work', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const original = adapter.readImpactSource.bind(adapter);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const read = vi.spyOn(adapter, 'readImpactSource');
  read.mockImplementationOnce(original).mockImplementationOnce(async (req) => {
    await pending;
    return original(req);
  });
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />);
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  await user.click(screen.getByRole('button', { name: 'Cancel scan' }));
  await screen.findByText('Cancelled; completed files retained');
  expect(screen.getByText('1 of 2 sources processed')).toBeVisible();
  await act(async () => {
    release();
  });
  expect(screen.queryByText('File #502')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Resume scan' }));
  await screen.findByText('Scan complete');
  expect(read).toHaveBeenCalledTimes(3);
  expect(read.mock.calls.map(([req]) => req.fileId)).toEqual(['501', '502', '502']);
});

it('shows permission failures and cache unavailability without claiming unused or safe', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'readImpactSource').mockRejectedValue(
    new SuiteLensError('PERMISSION_DENIED', 'secret detail'),
  );
  const cache = cacheForTest();
  vi.spyOn(cache, 'set').mockRejectedValue(new Error('quota'));
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cache} />);
  await fill(user, 'script:501');
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  expect(screen.getByText('0 possible references · 1 source not checked')).toBeVisible();
  expect(screen.getByText(/Local cache is unavailable/)).toBeVisible();
  expect(screen.queryByText('secret detail')).not.toBeInTheDocument();
  expect(screen.queryByText('No candidate references in this file.')).not.toBeInTheDocument();
});

it('renders untrusted source as text and discloses clipped lines', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'readImpactSource').mockResolvedValue({
    accountId: recordContext().accountId,
    fileId: '501',
    source: 'script',
    url: recordContext().url,
    content: 'custbody_demo_flag <img src=x onerror=alert(1)> ' + 'x'.repeat(600),
  });
  const view = render(
    <ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />,
  );
  await fill(user, 'script:501');
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  await user.click(screen.getByText('Code excerpt · line 1'));
  expect(screen.getByText(/1:.*<img src=x onerror=alert\(1\)>/)).toBeVisible();
  expect(view.container.querySelector('pre img')).toBeNull();
  expect(screen.getByText(/Long lines are clipped/)).toBeVisible();
});

it('reuses indexes across identifiers and persists an account-scoped opt-out that deletes indexes', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi.spyOn(adapter, 'readImpactSource');
  const cache = cacheForTest();
  const clearKind = vi.spyOn(cache, 'clearKind');
  const view = render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cache} />);
  await fill(user, 'script:501');
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  await user.clear(screen.getByLabelText('Field, script or saved search ID'));
  await user.type(screen.getByLabelText('Field, script or saved search ID'), 'beforeSubmit');
  await openOptions(user);
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText(/Results use a local index/);
  expect(read).toHaveBeenCalledTimes(1);
  await openOptions(user);
  await user.click(screen.getByRole('switch', { name: /^Remember script index for this account/ }));
  await waitFor(() =>
    expect(clearKind).toHaveBeenCalledWith(recordContext().accountId, 'impact-index'),
  );
  expect((await getAccountSettings(recordContext().accountId)).cacheImpactIndex).toBe(false);
  expect((await getAccountSettings('7654321-sb1')).cacheImpactIndex).toBeUndefined();
  await user.clear(screen.getByLabelText('Field, script or saved search ID'));
  await user.type(screen.getByLabelText('Field, script or saved search ID'), 'order');
  await openOptions(user);
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  expect(read).toHaveBeenCalledTimes(2);
  view.unmount();
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cache} />);
  await waitFor(() =>
    expect(
      screen.getByRole('switch', { name: /^Remember script index for this account/ }),
    ).toHaveAttribute('aria-checked', 'false'),
  );
});

it('stops dispatching after unmount and reports account errors with retry', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  let release!: () => void;
  const original = adapter.readImpactSource.bind(adapter);
  const read = vi.spyOn(adapter, 'readImpactSource').mockImplementationOnce(async (req) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return original(req);
  });
  const view = render(
    <ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />,
  );
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () => {
    release();
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(read).toHaveBeenCalledTimes(1);
  vi.spyOn(adapter, 'getPageContext').mockResolvedValue({
    ...recordContext(),
    accountId: '7654321',
  });
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />);
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(screen.queryByText('Scan complete')).not.toBeInTheDocument();
});

it('scans a saved-search line and shows title, public state, link and possible positions', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />);
  await fill(user, 'saved-search:503\nsaved-search:999');
  await user.click(screen.getByRole('button', { name: 'Scan or restore' }));
  await screen.findByText('Scan complete');
  expect(screen.getByText('2 of 2 sources processed')).toBeVisible();
  const summary = screen.getByRole('region', { name: 'Reference summary' });
  expect(within(summary).getByRole('row', { name: /Saved searches/ })).toHaveTextContent(
    '1/2 fully checked',
  );
  expect(summary).toHaveTextContent('1 public · 0 not public · 0 unknown visibility');
  expect(within(summary).getByRole('row', { name: /Script files/ })).toHaveTextContent(
    'Not included in scan',
  );
  expect(screen.getByText('Demo flagged orders')).toBeVisible();
  expect(screen.getByText('Public')).toBeVisible();
  expect(screen.getByRole('link', { name: /Open in NetSuite/ })).toHaveAttribute(
    'href',
    expect.stringContaining('search.nl?id=503'),
  );
  expect(screen.getByText('Filter 1 · field name · possible reference')).toBeVisible();
  expect(screen.getByText('Column 2 · formula · possible reference')).toBeVisible();
  await openCoverage(user);
  expect(screen.getByText(/1 saved search with possible references is public/)).toBeVisible();
  expect(screen.getByText('Not checked')).toBeVisible();
});

it('prefills files without reading and treats a bare customsearch ID as a saved search', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi.spyOn(adapter, 'readImpactSource');
  render(
    <ImpactAnalysis
      adapter={adapter}
      context={recordContext()}
      cache={cacheForTest()}
      initialFiles={['script:501']}
    />,
  );
  expect(screen.getByLabelText('File Cabinet files')).toHaveValue('script:501');
  expect(screen.getByText(/Nothing is read until you scan/)).toBeVisible();
  expect(read).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Field, script or saved search ID'), 'custbody_demo_flag');
  await user.type(screen.getByLabelText('File Cabinet files'), '{enter}customsearch_demo');
  expect(screen.getByRole('button', { name: 'Scan or restore' })).toBeEnabled();
});

it('scans all script files from one target input and shows discovered names', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi.spyOn(adapter, 'readImpactSource');
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />);
  expect(screen.getByRole('button', { name: 'Scan' })).toBeDisabled();
  await user.type(screen.getByLabelText('Field, script or saved search ID'), 'custbody_demo_flag');
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  await screen.findByText('Scan complete');
  await openCoverage(user);
  expect(screen.getByText('2 script files will be read.', { exact: false })).toBeVisible();
  // The bundle-owned file is disclosed, never silently dropped, and is never read.
  expect(
    screen.getByText('1 bundle-owned script file was skipped', { exact: false }),
  ).toBeVisible();
  expect(read).toHaveBeenCalledTimes(2);
  expect(screen.getByText('ue_demo_flag.js')).toBeVisible();
  expect(screen.getByText('1 source not checked', { exact: false })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  await screen.findByText('Scan complete');
  // Fresh inventory reuses the successful unchanged file; unreadable files are retried.
  expect(read).toHaveBeenCalledTimes(3);
  expect(screen.queryByText('Code excerpt · line 5')).not.toBeInTheDocument();
  expect(screen.getByText(/Results use a local index/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Rescan from source' }));
  await screen.findByText('Scan complete');
  expect(read).toHaveBeenCalledTimes(5);
  expect(screen.getByText('Code excerpt · line 5')).toBeVisible();
});

it('rejects an invalid folder ID before any query', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const run = vi.spyOn(adapter, 'runSuiteQL');
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />);
  await user.type(screen.getByLabelText('Field, script or saved search ID'), 'custbody_demo_flag');
  await user.type(screen.getByLabelText('File Cabinet folder ID (optional)'), 'abc');
  expect(screen.getByText('Enter a numeric folder internal ID.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Scan' })).toBeDisabled();
  expect(run).not.toHaveBeenCalled();
});

it('explicit library exclusions skip source reads, clear old results on edit, and allow re-inclusion', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const original = adapter.runSuiteQL.bind(adapter);
  vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) => {
    const result = await original(sql, options);
    return sql.includes('FROM file') && sql.includes('IN (')
      ? {
          ...result,
          rows: result.rows.map((row) => {
            const value = row as { id: number; name: string };
            return value.id === 501 ? { ...value, name: 'lodash.js' } : row;
          }),
        }
      : result;
  });
  const read = vi.spyOn(adapter, 'readImpactSource');
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />);
  const toggle = screen.getByRole('switch', { name: /^Exclude selected library file names/ });
  expect(toggle).not.toBeChecked();
  await user.type(screen.getByLabelText('Field, script or saved search ID'), 'custbody_demo_flag');
  await user.click(toggle);
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  await screen.findByText('Scan complete');
  expect(read.mock.calls.map(([request]) => request.fileId)).toEqual(['999']);
  await openCoverage(user);
  await user.click(screen.getByText('1 library file skipped by your filename exclusions'));
  expect(screen.getByText('lodash.js')).toBeVisible();
  expect(screen.getByText('Skipped: excluded library')).toBeVisible();
  expect(screen.getByText(/outside the scan plan/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Rescan from source' }));
  await screen.findByText('Scan complete');
  expect(read.mock.calls.every(([request]) => request.fileId !== '501')).toBe(true);
  await openOptions(user);
  await user.click(toggle);
  expect(screen.queryByText('Skipped: excluded library')).not.toBeInTheDocument();
  expect(screen.queryByText('Scan complete')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  await screen.findByText('Scan complete');
  expect(read.mock.calls.some(([request]) => request.fileId === '501')).toBe(true);
});

it('rejects wildcard exclusions and handles every discovered file being excluded', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const read = vi.spyOn(adapter, 'readImpactSource');
  render(<ImpactAnalysis adapter={adapter} context={recordContext()} cache={cacheForTest()} />);
  await user.type(screen.getByLabelText('Field, script or saved search ID'), 'custbody_demo_flag');
  await user.click(screen.getByRole('switch', { name: /^Exclude selected library file names/ }));
  const names = screen.getByLabelText('Library file names to exclude');
  await user.clear(names);
  await user.type(names, '*.js');
  expect(screen.getByRole('button', { name: 'Scan' })).toBeDisabled();
  await user.clear(names);
  await user.type(names, 'ue_demo_flag.js\nmissing_fixture.js');
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  await screen.findByText('2 library files skipped by your filename exclusions');
  await user.click(screen.getByText('Details', { exact: true }));
  expect(
    screen.getByText(
      'All discovered script files were excluded. Edit your exclusions or turn them off.',
    ),
  ).toBeVisible();
  expect(read).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Rescan from source' })).toBeNull();
  expect(screen.queryByText('Scan complete')).not.toBeInTheDocument();
});
