import { describe, expect, it } from 'vitest';
import fieldsFixture from '../../../fixtures/suiteql/context.fields.json';
import namesFixture from '../../../fixtures/suiteql/context.recordNames.json';
import recordsFixture from '../../../fixtures/suiteql/context.customRecords.json';
import {
  contextFieldsSql,
  contextCustomRecordsSql,
  contextRecordNamesSql,
  mapContextFields,
  mapContextRecordNames,
  mapContextCustomRecords,
  resolveContextSources,
} from './contextSources';

describe('context source metadata', () => {
  it('maps fixture rows without exporting row values and preserves ambiguous list identities', () => {
    const fields = mapContextFields(fieldsFixture.map((f) => ({ ...f, value: 'PRIVATE' })));
    const sources = resolveContextSources(
      fields,
      mapContextRecordNames(namesFixture),
      mapContextCustomRecords(recordsFixture),
    );
    expect(sources.custbody_suitelens_priority).toEqual({
      listSourceStatus: 'ambiguous',
      listSourceLabel: 'Demo Priority',
    });
    expect(JSON.stringify(fields)).not.toContain('PRIVATE');
  });
  it('resolves direct custom IDs and negative unique names but never guesses positive IDs', () => {
    const fields = mapContextFields([
      { ...fieldsFixture[0], scriptid: 'CUSTBODY_RECORD', fieldvaluetyperecord: 42 },
      {
        ...fieldsFixture[0],
        scriptid: 'CUSTBODY_ACCOUNT',
        fieldvaluetyperecord: -112,
        source_label: 'Account',
      },
      {
        ...fieldsFixture[0],
        scriptid: 'CUSTBODY_MISSING',
        fieldvaluetyperecord: 8,
        source_label: 'Account',
      },
      {
        ...fieldsFixture[0],
        scriptid: 'CUSTBODY_RENAMED',
        fieldvaluetyperecord: -10,
        source_label: 'Renamed Item',
      },
    ]);
    const result = resolveContextSources(
      fields,
      mapContextRecordNames(namesFixture),
      mapContextCustomRecords(recordsFixture),
    );
    expect(result.custbody_record).toMatchObject({
      listSource: 'customrecord_suitelens_demo',
      listSourceBasis: 'custom-record-id',
    });
    expect(result.custbody_account).toMatchObject({
      listSource: 'account',
      listSourceBasis: 'unique-display-name',
    });
    expect(result.custbody_missing).toMatchObject({ listSourceStatus: 'unmapped' });
    expect(result.custbody_missing?.listSource).toBeUndefined();
    expect(result.custbody_renamed?.listSource).toBeUndefined();
    expect(
      resolveContextSources([fields[0]!, fields[0]!], [], mapContextCustomRecords(recordsFixture))
        .custbody_record,
    ).toEqual({ listSourceStatus: 'ambiguous' });
  });
  it('bounds SQL placeholders and rejects malformed source identities', () => {
    for (const sql of [contextFieldsSql, contextCustomRecordsSql, contextRecordNamesSql]) {
      expect(sql(2).match(/\?/g)).toHaveLength(2);
      expect(() => sql(101)).toThrow();
      expect(() => sql(0)).toThrow();
    }
    expect(() =>
      mapContextCustomRecords([{ internalid: 1, scriptid: 'customlist_fake' }]),
    ).toThrow();
    expect(() =>
      mapContextFields([{ ...fieldsFixture[0], fieldvaluetyperecord: 'NaN' }]),
    ).toThrow();
  });
});
