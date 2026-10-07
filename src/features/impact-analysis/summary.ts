import type { ImpactScanProgress } from './scan';

export const SUMMARY_SOURCES = ['script', 'pdf-template', 'saved-search'] as const;
export type SummarySource = (typeof SUMMARY_SOURCES)[number];
export type SourceSummary = {
  source: SummarySource;
  planned: number;
  checked: number;
  notChecked: number;
  pending: number;
  objectsWithReferences: number;
  references: number;
};

/** Counts the entire scan, independent of file filters or pagination. Partial hits count as
 * observed candidates; a limit/permission failure never counts as fully checked. No risk score. */
export function summarizeImpact(progress: ImpactScanProgress) {
  const sources: SourceSummary[] = SUMMARY_SOURCES.map((source) => {
    const results =
      source === 'saved-search'
        ? progress.searchResults
        : progress.results.filter((result) => result.source === source);
    const planned =
      source === 'saved-search'
        ? (progress.plan.searches?.length ?? 0)
        : progress.plan.files.filter((file) => file.source === source).length;
    return {
      source,
      planned,
      checked: results.filter((result) => result.status === 'checked').length,
      notChecked: results.filter((result) => result.status === 'not-checked').length,
      pending: planned - results.length,
      objectsWithReferences: results.filter((result) => result.hits.length > 0).length,
      references: results.reduce((count, result) => count + result.hits.length, 0),
    };
  });
  const visibility = { public: 0, private: 0, unknown: 0 };
  for (const search of progress.searchResults) {
    if (!search.hits.length) continue;
    if (search.isPublic === true) visibility.public++;
    else if (search.isPublic === false) visibility.private++;
    else visibility.unknown++;
  }
  return { sources, visibility };
}
