import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { mixedProgress } from '../../test/impactSummary';
import { ReferenceSummary } from './ReferenceSummary';

it('shows lower-bound counts, incomplete reads and public/unknown visibility without a risk verdict', () => {
  render(<ReferenceSummary progress={mixedProgress()} />);
  const summary = screen.getByRole('region', { name: 'Reference summary' });
  const script = within(summary).getByRole('row', { name: /Script files/ });
  expect(script).toHaveTextContent('1/3 fully checked');
  expect(script).toHaveTextContent('1 not fully checked');
  expect(script).toHaveTextContent('1 pending');
  expect(
    within(script)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['2', '4']);
  expect(summary).toHaveTextContent('1 public · 1 not public · 1 unknown visibility');
  expect(summary).toHaveTextContent('including dynamic references and partial results');
  expect(summary).toHaveTextContent(
    'Active script status and released workflow usage were not checked',
  );
  expect(summary).toHaveTextContent('Change risk cannot be determined');
});

it('shows unplanned sources as not included instead of reporting zero references', () => {
  const progress = mixedProgress();
  progress.plan.files = [];
  progress.results = [];
  progress.plan.searches = ['503'];
  progress.searchResults = [];
  render(<ReferenceSummary progress={progress} />);
  const row = screen.getByRole('row', { name: /Script files/ });
  expect(row).toHaveTextContent('Not included in scan');
  expect(
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['—', '—']);
  expect(screen.getByRole('row', { name: /Saved searches/ })).toHaveTextContent('1 pending');
});
