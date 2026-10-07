import { describe, expect, it } from 'vitest';
import { mixedProgress } from '../../test/impactSummary';
import { summarizeImpact } from './summary';

describe('reference summary', () => {
  it('counts candidate locations separately from matching objects, retaining partial coverage', () => {
    const progress = mixedProgress();
    expect(progress.results[0]!.hits.some((hit) => hit.kind === 'dynamic-prefix')).toBe(true);
    expect(summarizeImpact(progress)).toEqual({
      sources: [
        {
          source: 'script',
          planned: 3,
          checked: 1,
          notChecked: 1,
          pending: 1,
          objectsWithReferences: 2,
          references: 4,
        },
        {
          source: 'pdf-template',
          planned: 1,
          checked: 1,
          notChecked: 0,
          pending: 0,
          objectsWithReferences: 0,
          references: 0,
        },
        {
          source: 'saved-search',
          planned: 5,
          checked: 3,
          notChecked: 1,
          pending: 1,
          objectsWithReferences: 3,
          references: 4,
        },
      ],
      visibility: { public: 1, private: 1, unknown: 1 },
    });
    // Counts are stable across checkpoint restoration and source list ordering.
    expect(summarizeImpact(structuredClone(progress))).toEqual(summarizeImpact(progress));
    expect(summarizeImpact({ ...progress, results: [...progress.results].reverse() })).toEqual(
      summarizeImpact(progress),
    );
  });

  it('does not count public searches without references as impacted, or unknown visibility as private', () => {
    const progress = mixedProgress();
    progress.searchResults[0]!.hits = [];
    expect(summarizeImpact(progress).visibility).toEqual({ public: 0, private: 1, unknown: 1 });
  });

  it('keeps unplanned sources distinct from planned sources with no completed reads', () => {
    const progress = mixedProgress();
    progress.plan.files = [{ fileId: '1', source: 'script' }];
    progress.plan.searches = undefined;
    progress.results = [];
    progress.searchResults = [];
    const { sources } = summarizeImpact(progress);
    expect(sources[0]).toMatchObject({ planned: 1, checked: 0, pending: 1 });
    expect(sources[1]).toMatchObject({ planned: 0, checked: 0, pending: 0 });
    expect(sources[2]).toMatchObject({ planned: 0, checked: 0, pending: 0 });
  });
});
