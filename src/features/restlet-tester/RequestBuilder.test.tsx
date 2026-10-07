import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { RequestBuilder } from './RequestBuilder';
const deployment = {
  scriptInternalId: '501',
  scriptId: 'customscript_demo',
  name: 'Demo',
  deploymentInternalId: '601',
  deploymentId: 'customdeploy_demo',
  status: 'Released',
  inactive: false,
  deployed: true,
};
it('does not dispatch a request after the builder unmounts while checking the target', async () => {
  const adapter = fixtureAdapter();
  let resolve!: (context: ReturnType<typeof recordContext>) => void;
  vi.spyOn(adapter, 'getPageContext').mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const send = vi.spyOn(adapter, 'callRestlet');
  const view = render(
    <RequestBuilder adapter={adapter} context={recordContext()} deployment={deployment} />,
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Send request' }));
  await waitFor(() => expect(resolve).toBeDefined());
  view.unmount();
  await act(async () => resolve(recordContext()));
  expect(send).not.toHaveBeenCalled();
});
