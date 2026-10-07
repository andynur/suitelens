import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { readRecordPayload } from '../../netsuite/parsers/recordPayload';
import { RecordCompare } from './RecordCompare';
import { comparePayloads } from './compare';

const payload = (xml: string) => readRecordPayload(`<record>${xml}</record>`).json;

it('matches reordered fields, repeated lines, attributes and missing versus empty values', () => {
  const a = payload(
    '<memo/><total currency="USD">1</total><line><item>A</item></line><line><item>B</item></line><field name="x">X</field><field name="y">Y</field>',
  );
  const b = payload(
    '<total currency="EUR">2</total><line><item>A</item></line><field name="y">Y</field><field name="x">X</field><new/><mixed>hello<b>bold</b>world</mixed>',
  );
  const rows = comparePayloads(a, b);
  expect(rows).toContainEqual({
    path: 'record/memo[1]',
    left: '',
    right: undefined,
    status: 'leftOnly',
  });
  expect(rows).toContainEqual({
    path: 'record/new[1]',
    left: undefined,
    right: '',
    status: 'rightOnly',
  });
  expect(rows).toContainEqual({
    path: 'record/total[1]/@currency',
    left: 'USD',
    right: 'EUR',
    status: 'changed',
  });
  expect(rows.find((row) => row.path === 'record/line[2]/item[1]')).toMatchObject({
    status: 'leftOnly',
    left: 'B',
  });
  expect(rows.find((row) => row.path === 'record/field["x"][1]')).toMatchObject({ status: 'same' });
  expect(rows.find((row) => row.path === 'record/mixed[1]/#text[2]')).toMatchObject({
    right: 'world',
  });
  expect(comparePayloads(a, a).every((row) => row.status === 'same')).toBe(true);
});

it('loads on explicit submit, validates IDs, retries errors and clears the comparison', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const get = vi.spyOn(adapter, 'getRecordXml');
  const active = readRecordPayload(
    await adapter.getRecordXml({ recordType: 'salesorder', id: '1001' }, '1234567-sb1'),
  ).json;
  get.mockClear();
  render(
    <RecordCompare adapter={adapter} context={recordContext()} active={active} masked={false} />,
  );
  expect(get).not.toHaveBeenCalled();
  const input = screen.getByRole('textbox', { name: 'Other record internal ID' });
  await user.type(input, '1001');
  expect(screen.getByRole('button', { name: 'Compare records' })).toBeDisabled();
  await user.clear(input);
  await user.type(input, '999');
  await user.click(screen.getByRole('button', { name: 'Compare records' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  await user.clear(input);
  await user.type(input, '1002');
  await user.click(screen.getByRole('button', { name: 'Compare records' }));
  const table = await screen.findByRole('table', { name: 'Record comparison' });
  expect(table).toHaveTextContent('Fake comparison order');
  expect(get).toHaveBeenLastCalledWith({ recordType: 'salesorder', id: '1002' }, '1234567-sb1', {
    comparison: true,
  });
  expect(table).not.toHaveTextContent('Unchanged');
  await user.click(screen.getByRole('button', { name: 'Show unchanged fields' }));
  expect(table).toHaveTextContent('Unchanged');
  await user.click(screen.getByRole('button', { name: 'Clear comparison' }));
  expect(screen.queryByRole('table')).toBeNull();
});

it('masks both sides before computing differences and hides results when the active payload is unavailable', async () => {
  const user = userEvent.setup();
  const adapter = fixtureAdapter();
  const get = vi
    .spyOn(adapter, 'getRecordXml')
    .mockResolvedValue(
      '<record id="1002" recordType="salesorder"><email>right@example.invalid</email></record>',
    );
  const active = readRecordPayload(
    '<record id="1001" recordType="salesorder"><email>left@example.invalid</email></record>',
  ).json;
  const props = { adapter, context: recordContext(), active, masked: false };
  const view = render(<RecordCompare {...props} />);
  await user.type(screen.getByRole('textbox'), '1002');
  await user.click(screen.getByRole('button', { name: 'Compare records' }));
  const table = await screen.findByRole('table');
  expect(table).toHaveTextContent('left@example.invalid');
  view.rerender(<RecordCompare {...props} masked />);
  expect(table).not.toHaveTextContent('example.invalid');
  await user.click(screen.getByRole('button', { name: 'Show unchanged fields' }));
  expect(table).toHaveTextContent('[MASKED]');
  expect(within(table).getAllByText('Unchanged').length).toBeGreaterThan(0);
  expect(get).toHaveBeenCalledTimes(1);
  view.rerender(<RecordCompare {...props} active={undefined} />);
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.getByRole('button', { name: 'Compare records' })).toBeDisabled();
});

it('discards late results after clear', async () => {
  let resolve!: (xml: string) => void;
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'getRecordXml').mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const user = userEvent.setup();
  render(
    <RecordCompare
      adapter={adapter}
      context={recordContext()}
      active={payload('<memo>active</memo>')}
      masked={false}
    />,
  );
  await user.type(screen.getByRole('textbox'), '1002');
  await user.click(screen.getByRole('button', { name: 'Compare records' }));
  expect(screen.getByRole('status')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear comparison' }));
  resolve('<record><memo>late</memo></record>');
  await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
});
