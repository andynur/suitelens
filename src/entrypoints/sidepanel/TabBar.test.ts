import { describe, expect, it } from 'vitest';
import { fitTabs, type TabItem } from './TabBar';

const items: TabItem[] = (['record', 'automation', 'console', 'logs', 'impact'] as const).map(
  (id) => ({ id, label: id, description: id }),
);
const ids = (list: TabItem[]) => list.map((item) => item.id);

describe('fitTabs', () => {
  it('shows every tab without layout (tests) or when all fit', () => {
    expect(ids(fitTabs(items, 'record', null).shown)).toHaveLength(5);
    const layout = { available: 500, widths: [100, 100, 100, 100, 100], more: 60 };
    expect(fitTabs(items, 'record', layout).overflow).toEqual([]);
  });

  it('moves tabs that do not fit into More, in order', () => {
    const layout = { available: 380, widths: [100, 100, 100, 100, 100], more: 60 };
    const { shown, overflow } = fitTabs(items, 'record', layout);
    expect(ids(shown)).toEqual(['record', 'automation', 'console']);
    expect(ids(overflow)).toEqual(['logs', 'impact']);
  });

  it('always keeps the selected tab in the row at its natural position', () => {
    const layout = { available: 380, widths: [100, 100, 100, 100, 100], more: 60 };
    const { shown, overflow } = fitTabs(items, 'impact', layout);
    expect(ids(shown)).toEqual(['record', 'automation', 'impact']);
    expect(ids(overflow)).toEqual(['console', 'logs']);
  });
});
