import { describe, expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../../test/adapters';
import {
  agentSnippet,
  buildRecordContext,
  contextFilePath,
  isRecordTypeId,
  loadRecordContext,
  mdCell,
  toJson,
  toMarkdown,
} from './contextModel';

const NOW = new Date('2026-10-06T12:00:00Z');

describe('loadRecordContext (salesorder fixture)', () => {
  it('exports non-active custom record definition IDs separately without reading its record', async () => {
    const adapter = fixtureAdapter();
    const fieldRead = vi.spyOn(adapter, 'getRecordFields');
    const model = await loadRecordContext(adapter, recordContext(), 'customrecord_suitelens_demo');
    expect(fieldRead).not.toHaveBeenCalled();
    expect(model.bodyFields).toEqual([]);
    expect(model.sublists).toEqual([]);
    expect(model.relatedCustomRecords).toEqual([]);
    expect(model.selectedCustomRecordFields).toEqual({
      basis: 'custom-field-definitions',
      status: 'partial',
      fieldIds: ['custrecord_demo_field'],
    });
    const section = toMarkdown(model)
      .split('## Selected custom record field identifiers')[1]!
      .split('## Related custom records')[0]!;
    expect(section).toContain('`custrecord_demo_field`');
    expect(section).toContain('no complete field schema');
    expect(toJson(model)).not.toMatch(/"value"|"recordId"|"accountId"/);
  });

  it('discloses missing or capped definition reads without inventing fields', async () => {
    const adapter = fixtureAdapter();
    const original = adapter.runSuiteQL.bind(adapter);
    const spy = vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) => {
      if (sql.includes('cf.recordtype')) throw new Error('PRIVATE-ROLE-ERROR');
      return original(sql, options);
    });
    const model = await loadRecordContext(adapter, recordContext(), 'customrecord_suitelens_demo');
    expect(model.selectedCustomRecordFields).toMatchObject({ status: 'not-checked', fieldIds: [] });
    expect(toMarkdown(model)).toContain('field coverage is not checked');
    expect(toJson(model)).not.toContain('PRIVATE-ROLE-ERROR');
    spy.mockImplementation(async (sql, options) => ({
      ...(await original(sql, options)),
      atLimit: true,
    }));
    const capped = await loadRecordContext(adapter, recordContext(), 'customrecord_suitelens_demo');
    expect(capped.limitations.join(' ')).toContain('reached the row limit');
    expect(capped.selectedCustomRecordFields?.status).toBe('partial');
  });

  it('produces Markdown with every custom body field and no values', async () => {
    const adapter = fixtureAdapter();
    const ctx = recordContext();
    const raw = await adapter.getRecordFields({ recordType: 'salesorder', id: ctx.recordId });
    const model = await loadRecordContext(adapter, ctx, 'salesorder', { now: NOW });
    const md = toMarkdown(model);

    const customBody = raw.fields.filter((f) => f.custom || f.id.startsWith('custbody_'));
    expect(customBody.length).toBeGreaterThan(0);
    for (const field of customBody) expect(md).toContain(`\`${field.id}\``);
    const customSection = md.split('## Custom body fields')[1]!.split('## Sublists')[0]!;
    for (const field of customBody) expect(customSection).toContain(`\`${field.id}\``);

    for (const field of [...raw.fields, ...raw.sublists.flatMap((s) => s.fields)]) {
      if (field.value && field.value.length > 3 && field.value !== field.label)
        expect(md).not.toContain(field.value);
    }
    expect(md).not.toContain(ctx.accountId);
    expect(md).not.toContain('netsuite.com');
    expect(md).toContain('Generated on 2026-10-06');
    expect(md).toContain('## Active scripts and deployments');
    expect(md).toContain('customscript_suitelens_so_ue');
    expect(md).toContain('## Related custom records');
    expect(md).toContain('`customrecord_suitelens_demo`: `custrecord_demo_field`');
    expect(md).toContain('## SuiteScript governance notes');
    expect(md).toContain('## How this was generated and limitations');
    expect(model.bodyFields.find((f) => f.id === 'custbody_suitelens_priority')).toMatchObject({
      listSourceStatus: 'ambiguous',
      listSourceLabel: 'Demo Priority',
    });
    expect(md).toContain('Demo Priority (ambiguous)');
    expect(model.relatedCustomRecords).toEqual([]);
    expect(model.accountCustomRecords.length).toBeGreaterThan(0);
  });

  it('serializes a value-free JSON model', async () => {
    const model = await loadRecordContext(fixtureAdapter(), recordContext(), 'salesorder', {
      now: NOW,
    });
    const json = JSON.parse(toJson(model)) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual([
      'schemaVersion',
      'generator',
      'generatedOn',
      'recordType',
      'bodyFields',
      'sublists',
      'relatedCustomRecordsBasis',
      'relatedCustomRecords',
      'accountCustomRecords',
      'scripts',
      'workflows',
      'governanceNotes',
      'limitations',
    ]);
    expect(json).toMatchObject({ schemaVersion: 2, recordType: 'salesorder' });
    expect(toJson(model)).not.toMatch(/"value"|"lineCount"|"recordId"|"accountId"/);
    expect(model.sublists.length).toBeGreaterThan(0);
  });

  it('skips fields for another record type and keeps partial results on failures', async () => {
    const adapter = fixtureAdapter();
    const spy = vi.spyOn(adapter, 'getRecordFields');
    vi.spyOn(adapter, 'getAutomations').mockRejectedValue(new Error('denied'));
    const model = await loadRecordContext(adapter, recordContext(), 'customer', { now: NOW });
    expect(spy).not.toHaveBeenCalled();
    expect(model.bodyFields).toEqual([]);
    expect(model.limitations.join('\n')).toMatch(/Fields were not read/);
    expect(model.limitations.join('\n')).toMatch(/Scripts and workflows could not be read/);
  });

  it('throws when every source fails, and rejects invalid record types', async () => {
    const adapter = fixtureAdapter();
    vi.spyOn(adapter, 'getRecordFields').mockRejectedValue(new Error('a'));
    vi.spyOn(adapter, 'getAutomations').mockRejectedValue(new Error('b'));
    vi.spyOn(adapter, 'runSuiteQL').mockRejectedValue(new Error('c'));
    await expect(loadRecordContext(adapter, recordContext(), 'salesorder')).rejects.toThrow('a');
    await expect(loadRecordContext(adapter, recordContext(), 'Sales Order')).rejects.toThrow(
      /record type/,
    );
  });

  it('rejects a result from another account', async () => {
    const adapter = fixtureAdapter();
    vi.spyOn(adapter, 'runSuiteQL').mockResolvedValue({
      accountId: 'other',
      rows: [],
      atLimit: false,
    });
    await expect(loadRecordContext(adapter, recordContext(), 'salesorder')).rejects.toThrow(
      /Account/,
    );
  });
  it('drops source identifiers on truncated metadata and propagates cancellation/account changes', async () => {
    const adapter = fixtureAdapter();
    const original = adapter.runSuiteQL.bind(adapter);
    vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) => {
      const result = await original(sql, options);
      return sql.includes('FROM scriptrecordtype') ? { ...result, atLimit: true } : result;
    });
    const model = await loadRecordContext(adapter, recordContext(), 'salesorder');
    expect(model.bodyFields.every((f) => !f.listSource && !f.listSourceStatus)).toBe(true);
    expect(model.limitations.join(' ')).toContain('could not be read completely');
    const controller = new AbortController();
    vi.mocked(adapter.runSuiteQL).mockImplementation(async (sql, options) => {
      const result = await original(sql, options);
      controller.abort();
      return result;
    });
    await expect(
      loadRecordContext(adapter, recordContext(), 'salesorder', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  it('binds only active custom field IDs, never record values', async () => {
    const adapter = fixtureAdapter();
    const spy = vi.spyOn(adapter, 'runSuiteQL');
    await loadRecordContext(adapter, recordContext(), 'salesorder');
    const call = spy.mock.calls.find(([sql]) => sql.includes('UPPER(scriptid)'))!;
    expect(call[1]?.params).toContain('CUSTBODY_SUITELENS_PRIORITY');
    expect(call[1]?.params).toContain('CUSTCOL_SUITELENS_BATCH');
    expect(call[1]?.params?.every((id) => /^CUST(BODY|COL)_/.test(String(id)))).toBe(true);
    expect(call[1]?.maxRows).toBe(1000);
  });
  it('exports resolved identifiers with provenance and rejects late cross-account lookups', async () => {
    const adapter = fixtureAdapter();
    const original = adapter.runSuiteQL.bind(adapter);
    const spy = vi.spyOn(adapter, 'runSuiteQL').mockImplementation(async (sql, options) => {
      const result = await original(sql, options);
      return sql.includes('UPPER(scriptid)')
        ? {
            ...result,
            rows: [
              {
                scriptid: 'CUSTBODY_SUITELENS_PRIORITY',
                fieldtype: 'BODY',
                fieldvaluetype: 'List/Record',
                fieldvaluetyperecord: 42,
                source_label: 'Demo Priority',
                value: 'PRIVATE',
              },
            ],
          }
        : result;
    });
    const model = await loadRecordContext(adapter, recordContext(), 'salesorder');
    expect(model.bodyFields.find((f) => f.id === 'custbody_suitelens_priority')).toMatchObject({
      listSource: 'customrecord_suitelens_demo',
      listSourceBasis: 'custom-record-id',
      listSourceStatus: 'resolved',
    });
    expect(model.relatedCustomRecords).toEqual([
      {
        scriptId: 'customrecord_suitelens_demo',
        basis: 'custom-record-id',
        references: [{ fieldId: 'custbody_suitelens_priority' }],
      },
    ]);
    expect(toJson(model)).not.toContain('PRIVATE');
    spy.mockImplementation(async (sql, options) => {
      const result = await original(sql, options);
      return sql.includes('FROM scriptrecordtype') ? { ...result, accountId: 'other' } : result;
    });
    await expect(loadRecordContext(adapter, recordContext(), 'salesorder')).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
  });
  it('caps enrichment without dropping record fields', async () => {
    const adapter = fixtureAdapter();
    const raw = await adapter.getRecordFields({
      recordType: 'salesorder',
      id: recordContext().recordId,
    });
    const fields = Array.from({ length: 101 }, (_, i) => ({
      id: `custbody_demo_${i}`,
      custom: true,
      sources: [],
    }));
    vi.spyOn(adapter, 'getRecordFields').mockResolvedValue({ ...raw, fields, sublists: [] });
    const spy = vi.spyOn(adapter, 'runSuiteQL');
    const model = await loadRecordContext(adapter, recordContext(), 'salesorder');
    expect(model.bodyFields).toHaveLength(101);
    expect(
      spy.mock.calls.find(([sql]) => sql.includes('UPPER(scriptid)'))?.[1]?.params,
    ).toHaveLength(100);
    expect(model.limitations.join(' ')).toContain('limited to the first 100');
  });
});

describe('builders', () => {
  it('uses exact selected-type definitions beyond the account display cap, excluding inferred IDs', () => {
    const customMetadata: import('../../../shared/storage/consoleLibrary').MetadataTable[] =
      Array.from({ length: 201 }, (_, i) => ({
        name: `customrecord_a${i}`,
        columns: ['id', 'custrecord_other'],
        source: 'custom' as const,
      }));
    customMetadata.push({
      name: 'customrecord_selected',
      source: 'custom',
      columns: ['id', 'custrecord_b', 'custrecord_a', 'custrecord_a', 'custbody_wrong', 'INVALID'],
    });
    customMetadata.push({
      name: 'customrecord_selected',
      source: 'imported',
      columns: ['custrecord_imported'],
    });
    const model = buildRecordContext({ recordType: 'customrecord_selected', customMetadata });
    expect(model.accountCustomRecords).toHaveLength(200);
    expect(model.selectedCustomRecordFields).toMatchObject({
      fieldIds: ['custrecord_a', 'custrecord_b'],
    });
    expect(
      buildRecordContext({ recordType: 'customrecord_unknown', customMetadata })
        .selectedCustomRecordFields,
    ).toMatchObject({ status: 'not-checked', fieldIds: [] });
    expect(
      buildRecordContext({ recordType: 'salesorder', customMetadata }).selectedCustomRecordFields,
    ).toBeUndefined();
  });

  it('groups body/sublist references without relying on the account index or name candidates', () => {
    const field = (id: string) => ({ id, custom: true, sources: [] });
    const direct = {
      listSource: 'customrecord_target',
      listSourceStatus: 'resolved' as const,
      listSourceBasis: 'custom-record-id' as const,
    };
    const model = buildRecordContext({
      recordType: 'salesorder',
      fields: {
        warnings: [],
        fields: [field('custbody_target'), field('custbody_name'), field('custbody_ambiguous')],
        sublists: [
          { id: 'item', lineCount: 0, fields: [field('custcol_target'), field('custcol_target')] },
          { id: 'expense', lineCount: 0, fields: [field('custcol_target')] },
        ],
      },
      listSources: {
        custbody_target: direct,
        custcol_target: direct,
        custbody_name: { ...direct, listSourceBasis: 'unique-display-name' },
        custbody_ambiguous: { ...direct, listSourceStatus: 'ambiguous' },
        custbody_absent: { ...direct, listSource: 'customrecord_absent' },
      },
    });
    expect(model.accountCustomRecords).toEqual([]);
    expect(model.relatedCustomRecords).toEqual([
      {
        scriptId: 'customrecord_target',
        basis: 'custom-record-id',
        references: [
          { fieldId: 'custbody_target' },
          { fieldId: 'custcol_target', sublistId: 'expense' },
          { fieldId: 'custcol_target', sublistId: 'item' },
        ],
      },
    ]);
    const section = toMarkdown(model)
      .split('## Related custom records')[1]!
      .split('## Account custom record index')[0]!;
    expect(section).toContain('`expense` / `custcol_target`');
    expect(section).not.toMatch(/custbody_name|custbody_ambiguous|customrecord_absent/);
  });

  it('escapes table cells and drops values and inactive automations', () => {
    const model = buildRecordContext({
      recordType: 'salesorder',
      now: NOW,
      fields: {
        warnings: [],
        sublists: [],
        fields: [
          {
            id: 'custbody_x',
            label: 'A | B\nC',
            type: 'select',
            value: 'SECRET-VALUE',
            mandatory: true,
            custom: true,
            sources: ['xml'],
          },
        ],
      },
      automations: {
        complete: false,
        warnings: [],
        items: [
          { kind: 'user_event', name: 'On', internalId: '1', isDeployed: true },
          { kind: 'user_event', name: 'Off', internalId: '2', isInactive: true },
          { kind: 'workflow', name: 'Approval', internalId: '3', trigger: 'BEFORESUBMIT' },
        ],
      },
    });
    const md = toMarkdown(model);
    expect(md).toContain('| `custbody_x` | A \\| B C | select | yes | — |');
    expect(md).not.toContain('SECRET-VALUE');
    expect(model.scripts.map((s) => s.name)).toEqual(['On']);
    expect(model.workflows.map((s) => s.name)).toEqual(['Approval']);
    expect(model.limitations.join()).toMatch(/approximate/);
    expect(mdCell(undefined)).toBe('—');
    expect(mdCell('a\\|b')).toBe('a\\\\\\|b');
  });

  it('validates record type IDs and builds the agent snippet', () => {
    expect(isRecordTypeId('salesorder')).toBe(true);
    expect(isRecordTypeId('customrecord_x1')).toBe(true);
    expect(isRecordTypeId('Sales Order')).toBe(false);
    expect(isRecordTypeId('../x')).toBe(false);
    expect(contextFilePath('salesorder')).toBe('netsuite-context/salesorder.md');
    const snippet = agentSnippet(['salesorder', 'salesorder', 'bad id']);
    expect(snippet).toContain('`netsuite-context/salesorder.md`');
    expect(snippet).toContain('`netsuite-context/salesorder.json`');
    expect(snippet).not.toContain('bad id');
    expect(agentSnippet([])).toContain('<recordtype>.md');
  });
});
