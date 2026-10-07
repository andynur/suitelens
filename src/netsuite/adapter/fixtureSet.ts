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

const impactFiles = import.meta.glob<string>('../../../fixtures/impact-analysis/*.{js,xml}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const pdfEditorFiles = import.meta.glob<string>(
  '../../../fixtures/impact-analysis/pdf-editor.html',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);
const savedSearchFiles = import.meta.glob<unknown>(
  '../../../fixtures/impact-analysis/saved-search.json',
  {
    import: 'default',
    eager: true,
  },
);
const savedSearchPageFiles = import.meta.glob<string>(
  '../../../fixtures/pages/saved-search-list.html',
  { query: '?raw', import: 'default', eager: true },
);

const baseName = (path: string) => (path.split('/').pop() ?? path).replace(/\.(xml|json)$/, '');

export function loadFixtureSet(): FixtureSet {
  const set: FixtureSet = { records: {}, currentRecords: {}, suiteql: {}, customRecordTypes: {} };
  set.savedSearchPages = {
    '/app/common/search/searchlist.nl': Object.values(savedSearchPageFiles)[0] ?? '',
  };
  for (const [path, xml] of Object.entries(recordFiles)) set.records[baseName(path)] = xml;
  for (const [path, json] of Object.entries(currentRecordFiles)) {
    set.currentRecords[baseName(path)] = CurrentRecordFieldsSchema.parse(json);
  }
  for (const [path, json] of Object.entries(suiteqlFiles)) {
    if (Array.isArray(json)) set.suiteql[baseName(path)] = json;
  }
  for (const map of Object.values(customRecordTypes)) Object.assign(set.customRecordTypes, map);
  set.impactPdfEditor = Object.values(pdfEditorFiles)[0];
  set.impactSources = {};
  set.impactSavedSearches = {};
  for (const definition of Object.values(savedSearchFiles)) {
    const fixture = { definition, link: '/app/common/search/search.nl?id=503' };
    set.impactSavedSearches['503'] = fixture;
    set.impactSavedSearches['customsearch_demo_flag'] = fixture;
  }
  for (const [path, content] of Object.entries(impactFiles)) {
    const source = path.endsWith('.js') ? 'script' : 'pdf-template';
    const fileId = source === 'script' ? '501' : '502';
    set.impactSources[fileId] = {
      source,
      content,
      link: `/core/media/media.nl?id=${fileId}&h=fake-fixture`,
    };
  }
  return set;
}
