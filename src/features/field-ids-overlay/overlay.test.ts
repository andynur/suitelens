import { describe, expect, it } from 'vitest';
import { loadFixturePage } from '../../test/fixtures';
import { readFieldLabels } from '../../netsuite/parsers/formDom';
import { hideFieldIdBadges, showFieldIdBadges, watchFieldIdBadges } from './overlay';

describe('field ID badges', () => {
  it('adds a badge to every label on the fixture form (≥ 90%)', () => {
    const doc = loadFixturePage('salesorder-view.html');
    const labels = doc.querySelectorAll('span[id$="_fs_lbl"]').length;
    const added = showFieldIdBadges(doc);
    expect(added / labels).toBeGreaterThanOrEqual(0.9);
    expect(doc.querySelector('#memo_fs_lbl [data-loupe="field-id"]')?.textContent).toBe('memo');
    // Idempotent, and labels are still read correctly with badges present.
    expect(showFieldIdBadges(doc)).toBe(0);
    expect(readFieldLabels(doc).find((l) => l.id === 'memo')?.label).toBe('Memo');
  });

  it('keeps the field ID lowercase even inside uppercase NetSuite labels', () => {
    const doc = loadFixturePage('salesorder-view.html');
    showFieldIdBadges(doc);
    const css = doc.getElementById('netsuite-loupe-field-id-style')?.textContent ?? '';
    expect(css).toContain('text-transform:none!important');
    expect(css).toContain('letter-spacing:normal!important');
  });

  it('removes badges and the injected style', () => {
    const doc = loadFixturePage('salesorder-view.html');
    showFieldIdBadges(doc);
    hideFieldIdBadges(doc);
    expect(doc.querySelectorAll('[data-loupe="field-id"]')).toHaveLength(0);
    expect(doc.getElementById('netsuite-loupe-field-id-style')).toBeNull();
  });

  it('watch mode re-applies badges to new labels and cleans up on stop', async () => {
    const stop = watchFieldIdBadges(document);
    const label = document.createElement('span');
    label.id = 'custbody_late_fs_lbl';
    label.textContent = 'Late';
    document.body.append(label);
    await new Promise((r) => setTimeout(r, 300));
    expect(label.querySelector('[data-loupe="field-id"]')?.textContent).toBe('custbody_late');
    stop();
    expect(document.querySelectorAll('[data-loupe="field-id"]')).toHaveLength(0);
  });
});
