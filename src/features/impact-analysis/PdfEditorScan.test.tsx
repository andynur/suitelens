import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { fixtureAdapter } from '../../test/adapters';
import { SO_URL } from '../../test/fixtures';
import { detectFromUrl } from '../../netsuite/context/detect';
import { SuiteLensError } from '../../netsuite/errors';
import type { PdfEditorSource } from '../../netsuite/impact/pdfEditor';
import { PdfEditorScan } from './PdfEditorScan';

const url = new URL(
  '/app/common/custom/advancedprint/pdftemplate.nl?id=3&nl=T&source=F&e=T',
  SO_URL,
).href;
const context = detectFromUrl(url)!;

it('requires an explicit scan, labels unsaved identity and rereads without retaining content', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter(url);
  const read = vi.spyOn(adapter, 'readImpactPdfEditor');
  const view = render(
    <PdfEditorScan
      adapter={adapter}
      context={context}
      target="custbody_demo_flag"
      disabled={false}
    />,
  );
  expect(read).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Scan open PDF editor' }));
  await screen.findByText('Unsaved template customization');
  expect(screen.getByText('Line 4, column 13 · possible reference')).toBeVisible();
  expect(screen.queryByText(/Template #/)).not.toBeInTheDocument();
  expect(screen.queryByText(/\$\{record/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open editor in NetSuite/ })).toHaveAttribute(
    'href',
    url,
  );
  const old = await adapter.readImpactPdfEditor({ accountId: context.accountId, editorId: '3' });
  read.mockResolvedValueOnce({ ...old, content: '<pdf><body>changed</body></pdf>' });
  await user.click(screen.getByRole('button', { name: 'Scan open PDF editor' }));
  await screen.findByText('No candidate references in this editor snapshot.');
  view.unmount();
  render(
    <PdfEditorScan
      adapter={adapter}
      context={context}
      target="custbody_demo_flag"
      disabled={false}
    />,
  );
  expect(screen.queryByText('Unsaved template customization')).not.toBeInTheDocument();
});

it('hides editor action on other pages and respects invalid target/busy state', () => {
  const adapter = fixtureAdapter(url);
  const view = render(
    <PdfEditorScan adapter={adapter} context={detectFromUrl(SO_URL)!} target="" disabled />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.rerender(<PdfEditorScan adapter={adapter} context={context} target="" disabled />);
  expect(screen.getByRole('button', { name: 'Scan open PDF editor' })).toBeDisabled();
});

it('discards late replies when identifier changes', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter(url);
  const source = await adapter.readImpactPdfEditor({ accountId: context.accountId, editorId: '3' });
  let resolve!: (source: PdfEditorSource) => void;
  vi.spyOn(adapter, 'readImpactPdfEditor').mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = render(
    <PdfEditorScan
      adapter={adapter}
      context={context}
      target="custbody_demo_flag"
      disabled={false}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Scan open PDF editor' }));
  expect(screen.getByText('Reading PDF editor source')).toBeVisible();
  view.rerender(
    <PdfEditorScan adapter={adapter} context={context} target="custbody_other" disabled={false} />,
  );
  await act(async () => {
    resolve(source);
  });
  expect(screen.queryByText('Unsaved template customization')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('does not expose results when active page changes during context recheck', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter(url);
  vi.spyOn(adapter, 'getPageContext').mockResolvedValue(detectFromUrl(SO_URL)!);
  render(
    <PdfEditorScan
      adapter={adapter}
      context={context}
      target="custbody_demo_flag"
      disabled={false}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Scan open PDF editor' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('shows a source-mode error with retry and never starts a File Cabinet read', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter(url);
  const fileRead = vi.spyOn(adapter, 'readImpactSource');
  vi.spyOn(adapter, 'readImpactPdfEditor').mockRejectedValueOnce(
    new SuiteLensError('UNSUPPORTED', 'Source Code required', 'Select Source Code in NetSuite.'),
  );
  render(
    <PdfEditorScan
      adapter={adapter}
      context={context}
      target="custbody_demo_flag"
      disabled={false}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Scan open PDF editor' }));
  await screen.findByRole('alert');
  await user.click(screen.getByText('Details'));
  expect(screen.getByText('Select Source Code in NetSuite.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Unsaved template customization');
  expect(fileRead).not.toHaveBeenCalled();
});
