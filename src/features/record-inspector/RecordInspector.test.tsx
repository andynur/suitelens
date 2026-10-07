import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { RecordInspector } from './RecordInspector';

vi.mock('../../shared/ui/clipboard', () => ({ copyWithToast: vi.fn().mockResolvedValue(true) }));
vi.mock('../../shared/ui/download', () => ({ downloadLocal: vi.fn() }));

it('defaults to JSON, shows saved XML, folds branches, searches values and switches to normalized JSON', async () => {
  const user = userEvent.setup();
  render(<RecordInspector adapter={fixtureAdapter()} context={recordContext()} />);
  expect(await screen.findByRole('region', { name: 'JSON payload' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^JSON$/ })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: /^XML$/ }));
  const xml = screen.getByRole('region', { name: 'XML payload' });
  expect(xml).toHaveTextContent('<memo>Fake order for SuiteLens fixtures</memo>');
  expect(xml).not.toHaveTextContent('FAKE-CSRF');
  const record = xml.querySelectorAll('summary')[1]!;
  await user.click(record);
  await waitFor(() => expect(xml).not.toHaveTextContent('Fake order for SuiteLens fixtures'));
  await user.type(screen.getByRole('searchbox'), 'widget b');
  expect(xml).toHaveTextContent('Fake Widget B');
  expect(xml).not.toHaveTextContent('Fake Widget A');
  await user.clear(screen.getByRole('searchbox'));
  await user.click(screen.getByRole('button', { name: /^JSON$/ }));
  const json = screen.getByRole('region', { name: 'JSON payload' });
  expect(json).toHaveTextContent('"name": "nsResponse"');
  await user.type(screen.getByRole('searchbox'), 'SO-FAKE');
  expect(json).toHaveTextContent('SO-FAKE-1001');
  await user.clear(screen.getByRole('searchbox'));
  await user.type(screen.getByRole('searchbox'), 'nothing-matches');
  expect(screen.getByText('No payload entries match your search.')).toBeInTheDocument();
});

describe('RecordInspector async states', () => {
  it('explains unsaved records without requesting XML', () => {
    const adapter = fixtureAdapter();
    const load = vi.spyOn(adapter, 'getRecordXml');
    render(
      <RecordInspector adapter={adapter} context={{ ...recordContext(), recordId: undefined }} />,
    );
    expect(screen.getByText('Save this record first')).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it('shows an error with retry and refreshes manually', async () => {
    const adapter = fixtureAdapter();
    const load = vi.spyOn(adapter, 'getRecordXml').mockRejectedValueOnce(new Error('unavailable'));
    render(<RecordInspector adapter={adapter} context={recordContext()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Copy payload' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download payload' })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('region', { name: 'JSON payload' });
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByRole('region', { name: 'JSON payload' });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('hides old payloads immediately on a context change and discards late answers', async () => {
    let resolve!: (xml: string) => void;
    const adapter = fixtureAdapter();
    vi.spyOn(adapter, 'getRecordXml').mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const view = render(<RecordInspector adapter={adapter} context={recordContext()} />);
    const ctx = {
      ...recordContext(),
      accountId: '1234567-sb2',
      url: recordContext().url.replace('sb1', 'sb2'),
    };
    view.rerender(<RecordInspector adapter={adapter} context={ctx} />);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Copy payload' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download payload' })).toBeDisabled();
    resolve('<record><memo>late old account</memo></record>');
    await waitFor(() => expect(screen.queryByText(/late old account/)).toBeNull());
  });
});

it('masks nested business fields without changing the source or record identifiers', async () => {
  const { maskPayload, serializePayloadXml, payloadFilename } = await import('./payloadExport');
  const { readRecordPayload } = await import('../../netsuite/parsers/recordPayload');
  const source = readRecordPayload(
    '<record id="1" recordType="customer" email="a&amp;b"><field name="custentity_tax_id" value="SECRET">TAX</field><machine name="addressbook"><line city="Town"><label>HQ</label></line></machine><memo>Keep &amp; &lt;this&gt;</memo><phone/><bankaccount number="123">456</bankaccount></record>',
  );
  const original = JSON.stringify(source);
  const masked = maskPayload(source.json);
  const xml = serializePayloadXml(masked);
  expect(xml).not.toMatch(/SECRET|TAX|Town|HQ|123|456|a&amp;b/);
  expect(xml).toContain('name="custentity_tax_id"');
  expect(xml).toContain('id="1" recordType="customer"');
  expect(xml).toContain('Keep &amp; &lt;this&gt;');
  expect(xml).toContain('[MASKED]');
  expect(readRecordPayload(xml).json).toEqual(masked);
  expect(JSON.stringify(source)).toBe(original);
  expect(payloadFilename('a/b', 'customer', '../1', 'xml', true)).toBe(
    'suitelens-a_b-customer-___1-masked.xml',
  );
});

it('copies and downloads complete payloads using current masking and format, independent of search', async () => {
  const { copyWithToast } = await import('../../shared/ui/clipboard');
  const { downloadLocal } = await import('../../shared/ui/download');
  const url = 'https://1234567-sb1.app.netsuite.com/app/common/entity/custjob.nl?id=2001&e=T';
  const user = userEvent.setup();
  render(<RecordInspector adapter={fixtureAdapter(url)} context={recordContext(url)} />);
  expect(screen.getByRole('button', { name: 'Copy payload' })).toBeDisabled();
  await screen.findByRole('region', { name: 'JSON payload' });
  await user.click(screen.getByRole('switch', { name: /^Mask values/ }));
  expect(screen.getByRole('switch', { name: /^Mask values/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await user.type(screen.getByRole('searchbox'), 'buyer@example.invalid');
  expect(screen.getByText('No payload entries match your search.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Copy payload' }));
  const json = vi.mocked(copyWithToast).mock.calls.at(-1)![0];
  expect(JSON.parse(json)).toHaveProperty('name', 'nsResponse');
  expect(json).toContain('CUST-FAKE-2001');
  expect(json).not.toContain('buyer@example.invalid');
  await user.click(screen.getByRole('button', { name: /^XML$/ }));
  await user.click(screen.getByRole('button', { name: 'Download payload' }));
  expect(downloadLocal).toHaveBeenLastCalledWith(
    expect.stringContaining('<email>[MASKED]</email>'),
    'suitelens-1234567-sb1-customer-2001-masked.xml',
    'application/xml;charset=utf-8',
  );
  await user.click(screen.getByRole('switch', { name: /^Mask values/ }));
  await user.click(screen.getByRole('button', { name: 'Copy payload' }));
  expect(copyWithToast).toHaveBeenLastCalledWith(
    expect.stringContaining('buyer@example.invalid'),
    'Payload copied.',
  );
  expect(vi.mocked(copyWithToast).mock.calls.at(-1)![0]).not.toContain('FAKE-CSRF');
});

it('shows the payload first and opens Compare only on demand', async () => {
  render(<RecordInspector adapter={fixtureAdapter()} context={recordContext()} />);
  await screen.findByRole('region', { name: 'JSON payload' });
  expect(screen.queryByRole('region', { name: 'Mini Record Compare' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Related transactions' })).toBeNull();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Compare with…' }));
  expect(screen.getAllByRole('region', { name: 'Mini Record Compare' })).toHaveLength(1);
});
