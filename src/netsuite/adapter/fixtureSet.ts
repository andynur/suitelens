import { CurrentRecordFieldsSchema } from '../parsers/mergeFields';
import type { FixtureSet } from './FixtureAdapter';

/**
 * Loads the bundled fixtures from /fixtures. Only imported by dev/fixture builds and tests;
 * production builds tree-shake it away (see shared/adapter.ts).
 */
const recordFiles = import.meta.glob<string>('../../../fixtures/records/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const currentRecordFiles = import.meta.glob<unknown>('../../../fixtures/current-record/*.json', {
  import: 'default',
  eager: true,
});
const suiteqlFiles = import.meta.glob<unknown>('../../../fixtures/suiteql/*.json', {
  import: 'default',
  eager: true,
});
const customRecordTypes = import.meta.glob<Record<string, string>>(
  '../../../fixtures/custom-record-types.json',
  { import: 'default', eager: true },
);

const baseName = (path: string) => (path.split('/').pop() ?? path).replace(/\.(xml|json)$/, '');

export function loadFixtureSet(): FixtureSet {
  const set: FixtureSet = { records: {}, currentRecords: {}, suiteql: {}, customRecordTypes: {} };
  for (const [path, xml] of Object.entries(recordFiles)) set.records[baseName(path)] = xml;
  for (const [path, json] of Object.entries(currentRecordFiles)) {
    set.currentRecords[baseName(path)] = CurrentRecordFieldsSchema.parse(json);
  }
  for (const [path, json] of Object.entries(suiteqlFiles)) {
    if (Array.isArray(json)) set.suiteql[baseName(path)] = json;
  }
  for (const map of Object.values(customRecordTypes)) Object.assign(set.customRecordTypes, map);
  return set;
}
