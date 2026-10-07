import type { SavedSearchDefinition } from '../../netsuite/impact/savedSearch';
import { scanReferences } from './references';

export type SearchReferenceHit = {
  confidence: 'possible';
  kind: 'exact-token' | 'dynamic-prefix';
  area: 'filter' | 'column';
  /** One-based position in the filter or column list. */
  member: number;
  part: 'name' | 'formula';
};
export type SearchReferenceScan = {
  status: 'checked' | 'not-checked';
  reason?: 'invalid-target' | 'match-limit';
  hits: SearchReferenceHit[];
};

const HIT_LIMIT = 1_000;
const targetPattern = /^(?:[a-zA-Z_][a-zA-Z0-9_]*|[1-9][0-9]*)$/;

/**
 * Candidate finder over a read-only saved search definition: member names and formula text
 * only. Filter values and results are never read. A match is possible, never certain, and a
 * clean scan cannot prove the field is unused (summary/join filters, other search types).
 */
export function scanSavedSearch(
  definition: SavedSearchDefinition,
  target: string,
): SearchReferenceScan {
  if (!targetPattern.test(target) || target.length > 128)
    return { status: 'not-checked', reason: 'invalid-target', hits: [] };
  const hits: SearchReferenceHit[] = [];
  for (const [area, members] of [
    ['filter', definition.filters],
    ['column', definition.columns],
  ] as const) {
    for (const [index, member] of members.entries()) {
      const base = { confidence: 'possible', area, member: index + 1 } as const;
      if (member.name === target) hits.push({ ...base, kind: 'exact-token', part: 'name' });
      if (member.formula) {
        const scanned = scanReferences(member.formula, target, 'script', {
          includeExcerpts: false,
        });
        for (const hit of scanned.hits) hits.push({ ...base, kind: hit.kind, part: 'formula' });
      }
      if (hits.length > HIT_LIMIT)
        return { status: 'not-checked', reason: 'match-limit', hits: hits.slice(0, HIT_LIMIT) };
    }
  }
  return { status: 'checked', hits };
}
