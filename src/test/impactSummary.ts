import type { ImpactScanProgress } from '../features/impact-analysis/scan';
import { scanReferences } from '../features/impact-analysis/references';

export function mixedProgress(): ImpactScanProgress {
  const hits = scanReferences(
    "'custbody_demo' 'custbody_' + suffix",
    'custbody_demo',
    'script',
  ).hits;
  const searchHit = {
    confidence: 'possible' as const,
    kind: 'exact-token' as const,
    area: 'filter' as const,
    member: 1,
    part: 'name' as const,
  };
  return {
    plan: {
      accountId: '1234567-sb1',
      target: 'custbody_demo',
      files: [
        { fileId: '1', source: 'script' },
        { fileId: '2', source: 'script' },
        { fileId: '3', source: 'script' },
        { fileId: '4', source: 'pdf-template' },
      ],
      searches: ['503', '504', '505', '506', '507'],
    },
    results: [
      { fileId: '1', source: 'script', status: 'checked', hits, checkedAt: 1, fromIndex: true },
      {
        fileId: '2',
        source: 'script',
        status: 'not-checked',
        reason: 'match-limit',
        hits,
        checkedAt: 1,
      },
      { fileId: '4', source: 'pdf-template', status: 'checked', hits: [], checkedAt: 1 },
    ],
    searchResults: [
      {
        searchId: '503',
        status: 'checked',
        hits: [searchHit, { ...searchHit, area: 'column', part: 'formula' }],
        isPublic: true,
        checkedAt: 1,
      },
      { searchId: '504', status: 'checked', hits: [searchHit], isPublic: false, checkedAt: 1 },
      { searchId: '505', status: 'checked', hits: [searchHit], checkedAt: 1 },
      {
        searchId: '506',
        status: 'not-checked',
        reason: 'PERMISSION_DENIED',
        hits: [],
        checkedAt: 1,
      },
    ],
    status: 'cancelled',
    updatedAt: 1,
    coverage: 'supplied-files-only',
    cacheAvailable: true,
  };
}
