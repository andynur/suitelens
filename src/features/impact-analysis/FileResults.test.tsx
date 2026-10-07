import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import {
  countFileResults,
  FILE_PAGE_SIZE,
  FileResultFilters,
  FileResultSection,
  sortFileResults,
  type FileFilter,
} from './FileResults';
import type { ImpactScanResult } from './scan';

const hit = (offset: number) => ({
  source: 'script' as const,
  confidence: 'possible' as const,
  kind: 'exact-token' as const,
  line: offset + 1,
  column: 1,
  offset,
  length: 5,
});

const file = (fileId: string, hits: number, notChecked = false): ImpactScanResult =>
  notChecked
    ? {
        fileId,
        source: 'script',
        status: 'not-checked',
        reason: 'INVALID_RESPONSE',
        failure: 'not-text',
        hits: [],
        checkedAt: 0,
      }
    : {
        fileId,
        source: 'script',
        status: 'checked',
        hits: Array.from({ length: hits }, (_, index) => hit(index)),
        checkedAt: 0,
      };

it('puts files with the most references first and unreadable files last', () => {
  const sorted = sortFileResults([
    file('1', 0),
    file('2', 0, true),
    file('3', 1),
    file('4', 3),
    file('5', 0),
  ]);
  expect(sorted.map((result) => result.fileId)).toEqual(['4', '3', '1', '5', '2']);
  expect(countFileResults(sorted)).toEqual({ all: 5, hits: 2, clean: 2, 'not-checked': 1 });
});

function Harness({ results }: { results: ImpactScanResult[] }) {
  const [filter, setFilter] = useState<FileFilter>('all');
  const [query, setQuery] = useState('');
  return (
    <>
      <FileResultFilters
        counts={countFileResults(results)}
        filter={filter}
        onFilter={setFilter}
        query={query}
        onQuery={setQuery}
      />
      <FileResultSection
        label="Script files"
        planned={results.length}
        results={results}
        filter={filter}
        query={query}
        names={new Map(results.map((result) => [result.fileId, `file_${result.fileId}.js`]))}
        now={0}
      />
    </>
  );
}

it('filters by result, searches by name and pages long lists', async () => {
  const user = userEvent.setup();
  const results = [
    ...Array.from({ length: FILE_PAGE_SIZE + 5 }, (_, index) => file(String(100 + index), 0)),
    file('7', 2),
    file('8', 0, true),
  ];
  render(<Harness results={results} />);
  const section = screen.getByRole('region', { name: 'Script files' });
  // The referenced file leads the list and starts open.
  expect(within(section).getAllByText(/^file_/)[0]).toHaveTextContent('file_7.js');
  expect(within(section).getByText('2 refs')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Show 7 more' })).toBeVisible();

  await user.click(screen.getByRole('button', { name: /^With references/ }));
  expect(
    within(section)
      .getAllByText(/^file_/)
      .map((node) => node.textContent),
  ).toEqual(['file_7.js']);
  await user.click(screen.getByRole('button', { name: /^Unreadable/ }));
  expect(within(section).getByText('Not checked')).toBeVisible();
  expect(within(section).queryByText('Script dependencies')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /^All/ }));
  await user.type(screen.getByLabelText('Filter by file name or ID'), 'file_101');
  expect(
    within(section)
      .getAllByText(/^file_/)
      .map((node) => node.textContent),
  ).toEqual(['file_101.js']);
  await user.clear(screen.getByLabelText('Filter by file name or ID'));
  await user.type(screen.getByLabelText('Filter by file name or ID'), 'nothing');
  expect(within(section).getByText('No files match this filter.')).toBeVisible();
});

it('shows transient source links and explains when restored links are unavailable', () => {
  render(
    <Harness
      results={[
        {
          ...file('1', 1),
          sourceUrl: 'https://1234567-sb1.app.netsuite.com/core/media/media.nl?id=1&h=fake',
        },
        file('2', 1),
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: /Open source in NetSuite/ })).toHaveAttribute(
    'href',
    'https://1234567-sb1.app.netsuite.com/core/media/media.nl?id=1&h=fake',
  );
  expect(screen.getByRole('link', { name: /Open source in NetSuite/ })).toHaveAttribute(
    'rel',
    'noreferrer noopener',
  );
  // The "link unavailable" status is listed once in the results header, not on each card.
  expect(screen.queryByText(/Source link unavailable/)).toBeNull();
});
