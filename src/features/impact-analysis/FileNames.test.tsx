import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { SuiteLensError } from '../../netsuite/errors';
import { FileNames } from './FileNames';
import type { ImpactScanPlan } from './scan';

const context = recordContext();
const plan: ImpactScanPlan = {
  accountId: context.accountId,
  target: 'custbody_demo_flag',
  files: [
    { source: 'script', fileId: '501' },
    { source: 'pdf-template', fileId: '502' },
  ],
};
const renderNames = (names: ReadonlyMap<string, string>) => <p>{[...names.values()].join(', ')}</p>;

it('reads only on explicit action and keeps missing-name IDs available', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const query = vi.spyOn(adapter, 'runSuiteQL');
  render(
    <FileNames
      adapter={adapter}
      plan={plan}
      pageUrl={context.url}
      names={new Map([['502', 'export.xml']])}
      disabled={false}
    >
      {renderNames}
    </FileNames>,
  );
  expect(query).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Load file names' }));
  await screen.findByText('export.xml, ue_demo_flag.js');
  expect(screen.getByText(/Names read for 1 of 2 planned files/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'About file names' }));
  expect(screen.getByText(/Script names and activation status are not checked/)).toBeVisible();
});

it('reads once automatically when auto is set and not disabled', async () => {
  const adapter = fixtureAdapter();
  const query = vi.spyOn(adapter, 'runSuiteQL');
  const view = render(
    <FileNames adapter={adapter} plan={plan} pageUrl={context.url} names={new Map()} disabled auto>
      {renderNames}
    </FileNames>,
  );
  expect(query).not.toHaveBeenCalled();
  view.rerender(
    <FileNames
      adapter={adapter}
      plan={plan}
      pageUrl={context.url}
      names={new Map()}
      disabled={false}
      auto
    >
      {renderNames}
    </FileNames>,
  );
  await screen.findByText('ue_demo_flag.js');
  expect(query).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Reload file names' })).toBeEnabled();
});

it('preserves supplied names on a permission failure and supports retry', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'runSuiteQL').mockRejectedValueOnce(
    new SuiteLensError('PERMISSION_DENIED', 'Denied'),
  );
  render(
    <FileNames
      adapter={adapter}
      plan={plan}
      pageUrl={context.url}
      names={new Map([['502', 'export.xml']])}
      disabled={false}
    >
      {renderNames}
    </FileNames>,
  );
  await user.click(screen.getByRole('button', { name: 'Load file names' }));
  await screen.findByRole('alert');
  expect(screen.getByText('export.xml')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('export.xml, ue_demo_flag.js');
});

it('discards an old adapter reply and allows the replacement adapter to load', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async () => {
    await pending;
    return { accountId: context.accountId, rows: [{ id: 501, name: 'late.js' }], atLimit: false };
  });
  const view = render(
    <FileNames
      adapter={adapter}
      plan={plan}
      pageUrl={context.url}
      names={new Map()}
      disabled={false}
    >
      {renderNames}
    </FileNames>,
  );
  await user.click(screen.getByRole('button', { name: 'Load file names' }));
  expect(screen.getByRole('button', { name: 'Load file names' })).toBeDisabled();
  view.rerender(
    <FileNames
      adapter={fixtureAdapter()}
      plan={plan}
      pageUrl={context.url}
      names={new Map()}
      disabled={false}
    >
      {renderNames}
    </FileNames>,
  );
  await act(async () => release());
  expect(screen.queryByText('late.js')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Load file names' }));
  await screen.findByText('ue_demo_flag.js');
  view.unmount();
});
