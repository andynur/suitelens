import { describe, expect, it } from 'vitest';
import { mapSavedSearchDefinition } from '../../netsuite/impact/savedSearch';
import { readFixture } from '../../test/fixtures';
import { scanSavedSearch } from './searchReferences';

const definition = mapSavedSearchDefinition(
  JSON.parse(readFixture('impact-analysis/saved-search.json')),
  '503',
);

describe('scanSavedSearch', () => {
  it('finds filter name and column formula references as possible', () => {
    const scan = scanSavedSearch(definition, 'custbody_demo_flag');
    expect(scan.status).toBe('checked');
    expect(scan.hits).toEqual([
      { confidence: 'possible', kind: 'exact-token', area: 'filter', member: 1, part: 'name' },
      { confidence: 'possible', kind: 'exact-token', area: 'column', member: 2, part: 'formula' },
    ]);
  });

  it('does not match partial identifiers and reports clean scans as checked', () => {
    expect(scanSavedSearch(definition, 'custbody_demo')).toEqual({ status: 'checked', hits: [] });
  });

  it('rejects an invalid target without scanning', () => {
    expect(scanSavedSearch(definition, 'bad id')).toEqual({
      status: 'not-checked',
      reason: 'invalid-target',
      hits: [],
    });
  });

  it('reports the maximum hit count without truncation', () => {
    const many = {
      ...definition,
      filters: Array.from({ length: 500 }, () => ({ name: 'custbody_x' })),
      columns: Array.from({ length: 500 }, () => ({ name: 'custbody_x' })),
    };
    const scan = scanSavedSearch(many, 'custbody_x');
    expect(scan.status).toBe('checked');
    expect(scan.hits).toHaveLength(1_000);
  });
});
