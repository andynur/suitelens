import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autoColumnWidths, ResultsTable } from './ResultsTable';
import { resultColumns, resultRowText, sortResults, type ResultRow } from './results';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('console results', () => {
  it('sorts numbers, booleans, natural strings and ties without mutating results; nulls stay last', () => {
    const rows: ResultRow[] = [{ id: 10 }, { id: null }, { id: 2 }, { id: 2 }, {}];
    expect(sortResults(rows, { column: 'id', direction: 'ascending' })).toEqual([
      rows[2],
      rows[3],
      rows[0],
      rows[1],
      rows[4],
    ]);
    expect(sortResults(rows, { column: 'id', direction: 'descending' })).toEqual([
      rows[0],
      rows[2],
      rows[3],
      rows[1],
      rows[4],
    ]);
    expect(rows[0]).toEqual({ id: 10 });
    expect(
      sortResults([{ a: 'SO10' }, { a: 'SO2' }], { column: 'a', direction: 'ascending' })[0],
    ).toEqual({ a: 'SO2' });
    expect(
      sortResults([{ a: true }, { a: false }], { column: 'a', direction: 'ascending' })[0],
    ).toEqual({ a: false });
  });
  it('keeps all columns and safely copies typed row values', () => {
    expect(resultColumns([{ a: null }, { b: false, a: '' }])).toEqual(['a', 'b']);
    expect(JSON.parse(resultRowText({ a: 'line\n\t"', b: false }, ['a', 'b', 'c']))).toEqual({
      a: 'line\n\t"',
      b: false,
      c: null,
    });
  });
  it('renders a bounded window for 50,000 rows and reaches the final row', () => {
    const rows = Array.from({ length: 50_000 }, (_, id) => ({ id }));
    render(<ResultsTable rows={rows} />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '50001');
    expect(screen.getAllByRole('row').length).toBeLessThan(30);
    const region = screen.getByRole('region');
    fireEvent.scroll(region, { target: { scrollTop: 1_599_712 } });
    expect(screen.getByText('49999')).toBeVisible();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getAllByRole('row').length).toBeLessThan(30);
    fireEvent.click(screen.getByRole('button', { name: /^id$/ }));
    expect(screen.getByText('0')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /^id$/ }));
    expect(screen.getByText('49999')).toBeVisible();
  });
  it('sorts locally, resizes with keyboard, and copies null, empty, false and rows', async () => {
    render(
      <ResultsTable
        rows={[
          { id: 10, value: null },
          { id: 2, value: '' },
          { id: 3, value: false },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^id$/ }));
    expect(screen.getByRole('columnheader', { name: /id/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(within(screen.getAllByRole('row')[1]!).getByText('2')).toBeVisible();
    const resize = screen.getByRole('separator', { name: 'Resize id column' });
    const initial = Number(resize.getAttribute('aria-valuenow'));
    fireEvent.keyDown(resize, { key: 'ArrowRight' });
    expect(resize).toHaveAttribute('aria-valuenow', String(initial + 16));
    fireEvent.keyDown(resize, { key: 'Home' });
    expect(resize).toHaveAttribute('aria-valuenow', '96');
    fireEvent.click(screen.getByRole('button', { name: 'Copy value, row 3' }));
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('null'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy value, row 1' }));
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(''));
    fireEvent.click(screen.getByRole('button', { name: 'Copy value, row 2' }));
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('false'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy row 3 as JSON' }));
    await vi.waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('{"id":10,"value":null}'),
    );
    expect(screen.getByText('null')).toBeVisible();
  });
});

describe('autoColumnWidths', () => {
  it('sizes columns to their longest value within the limits', () => {
    const widths = autoColumnWidths(
      [
        { id: 1, name: 'CUSTOMRECORD_IV_CONSOLIDATED_INVOICE_LINE' },
        { id: 22, name: 'x' },
      ],
      ['id', 'name'],
    );
    expect(widths.id).toBe(96);
    expect(widths.name).toBeGreaterThan(192);
    expect(widths.name).toBeLessThanOrEqual(640);
  });
});
