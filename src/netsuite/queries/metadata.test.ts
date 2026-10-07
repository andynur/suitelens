import { expect, it } from 'vitest';
import { loadFixtureSet } from '../adapter/fixtureSet';
import { METADATA_SOURCES, mapMetadata, mergeMetadata } from './metadata';
import { MetadataTableSchema } from '../../shared/storage/consoleLibrary';
it('maps every metadata source fixture and persists identifiers without record values', () => {
  const fixtures = loadFixtureSet().suiteql;
  let tables: ReturnType<typeof mapMetadata> = [];
  for (const source of METADATA_SOURCES) {
    const rows = fixtures[`metadata.${source.id}`]!;
    expect(rows).toBeDefined();
    const mapped = mapMetadata(source.id, rows as Record<string, unknown>[]);
    mapped.forEach((table) => MetadataTableSchema.parse(table));
    tables = mergeMetadata(tables, mapped);
  }
  expect(tables.find((table) => table.name === 'transaction')?.columns).toContain('custbody_demo');
  expect(JSON.stringify(tables)).not.toContain('Fake value');
  expect(JSON.stringify(tables)).not.toContain('Demo customer');
});
