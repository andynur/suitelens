import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFixturePage } from '../../test/fixtures';
import { highlightFieldOnPage } from './highlight';

describe('highlightFieldOnPage', () => {
  let doc: Document;
  const memoRow = () => doc.getElementById('memo_fs_lbl')!.closest('tr')!;

  beforeEach(() => {
    vi.useFakeTimers();
    doc = loadFixturePage('salesorder-view.html');
  });
  afterEach(() => vi.useRealTimers());

  it('outlines the field row and restores it afterwards', () => {
    const row = memoRow();
    row.style.outline = '1px dotted red';
    expect(highlightFieldOnPage(doc, 'memo', 1000)).toBe(true);
    // Parsed documents have no window, so jest-dom matchers do not apply here.
    expect(row.hasAttribute('data-suitelens-highlight')).toBe(true);
    expect(row.style.outline).toContain('solid');

    vi.advanceTimersByTime(1000);
    expect(row.hasAttribute('data-suitelens-highlight')).toBe(false);
    expect(row.style.outline).toBe('1px dotted red');
  });

  it('keeps the original style when highlighted twice in a row', () => {
    highlightFieldOnPage(doc, 'memo', 1000);
    highlightFieldOnPage(doc, 'memo', 1000);
    vi.advanceTimersByTime(1000);
    expect(memoRow().style.outline).toBe('');
  });

  it('returns false for fields without a label on the page', () => {
    expect(highlightFieldOnPage(doc, 'custbody_missing')).toBe(false);
  });
});
