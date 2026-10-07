import { describe, expect, it } from 'vitest';
import { readFixture } from '../../test/fixtures';
import {
  AUTOMATION_QUERIES,
  mapScriptDeploymentRows,
  mapWorkflowRows,
  matchesRecordType,
  sortAutomations,
  WORKFLOWS_QUERY,
} from './automation';

const rows = (name: string): unknown[] =>
  JSON.parse(readFixture(`suiteql/${name}.json`)) as unknown[];

describe('query definitions', () => {
  it('every query has a fixture for every variant and VERIFY-safe SQL', () => {
    for (const def of Object.values(AUTOMATION_QUERIES)) {
      expect(def.variants.length).toBeGreaterThan(0);
      for (const v of def.variants) {
        expect(rows(`${def.id}.${v.id}`).length).toBeGreaterThan(0);
        expect(v.sql.trim().toUpperCase().startsWith('SELECT')).toBe(true);
        expect(v.sql).not.toMatch(/;/);
      }
    }
  });
});

describe('matchesRecordType', () => {
  it('matches raw IDs, display labels and multi-select lists', () => {
    expect(matchesRecordType('salesorder', 'SALESORDER', undefined)).toBe(true);
    expect(matchesRecordType('salesorder', undefined, 'Sales Order')).toBe(true);
    expect(matchesRecordType('salesorder', 'INVOICE, SALESORDER', undefined)).toBe(true);
    expect(
      matchesRecordType('customrecord_suitelens_demo', 'CUSTOMRECORD_SUITELENS_DEMO', undefined),
    ).toBe(true);
    expect(matchesRecordType('salesorder', 'INVOICE', 'Invoice')).toBe(false);
    expect(matchesRecordType('salesorder', undefined, undefined)).toBe(false);
  });
});

describe('mapScriptDeploymentRows', () => {
  it('maps the full variant for sales orders', () => {
    const items = mapScriptDeploymentRows(rows('automation.scriptDeployments.full'), 'salesorder');
    expect(items.map((i) => i.scriptId)).toEqual([
      'customscript_suitelens_so_ue',
      'customscript_suitelens_so_cs',
      'customscript_suitelens_tax_ue',
      'customscript_suitelens_wfa_notify',
    ]);
    expect(items[0]).toEqual({
      kind: 'user_event',
      name: 'SuiteLens SO Validation UE',
      internalId: '101',
      scriptId: 'customscript_suitelens_so_ue',
      deploymentInternalId: '201',
      deploymentId: 'customdeploy_suitelens_so_ue',
      status: 'RELEASED',
      logLevel: 'DEBUG',
      scriptFileId: '9001',
      scriptFileName: 'suitelens_so_ue.js',
      isDeployed: true,
      isInactive: false,
      executionContexts: ['USERINTERFACE', 'WEBSERVICES', 'CSVIMPORT'],
    });
    expect(items[2]?.isDeployed).toBe(false);
    expect(items[3]?.kind).toBe('workflow_action');
  });

  it('maps the base variant (fewer columns) and skips invalid rows', () => {
    const items = mapScriptDeploymentRows(
      [
        ...rows('automation.scriptDeployments.base'),
        { scripttype: 'CLIENT' },
        'junk',
        {
          scriptinternalid: 1,
          scripttype: 'CLIENT',
          recordtype: 'SALESORDER',
          status: { bad: true },
        },
      ],
      'salesorder',
    );
    expect(items).toHaveLength(4);
    expect(items[0]?.logLevel).toBeUndefined();
    expect(items[0]?.isInactive).toBeUndefined();
  });

  it('ignores script types outside v0.1 scope', () => {
    const items = mapScriptDeploymentRows(rows('automation.scriptDeployments.full'), 'customer');
    expect(items.map((i) => i.kind)).toEqual(['user_event']);
  });

  it('falls back to script ID or internal ID for the name', () => {
    const [a] = mapScriptDeploymentRows(
      [
        {
          scriptinternalid: 9,
          scriptid: 'customscript_x',
          scripttype: 'client',
          recordtype: 'SALESORDER',
        },
      ],
      'salesorder',
    );
    expect(a?.name).toBe('customscript_x');
    const [b] = mapScriptDeploymentRows(
      [{ scriptinternalid: 9, scripttype: 'CLIENT', recordtype: 'SALESORDER' }],
      'salesorder',
    );
    expect(b?.name).toBe('9');
  });
});

describe('mapWorkflowRows', () => {
  it('maps workflows for the record type', () => {
    const items = mapWorkflowRows(rows('automation.workflows.full'), 'salesorder');
    // 301 and 302 by `recordtype`, 304 only through the multi-select `recordtypes`.
    expect(items.map((i) => i.internalId)).toEqual(['301', '302', '304']);
    expect(items[0]).toEqual({
      kind: 'workflow',
      name: 'SuiteLens SO Approval',
      internalId: '301',
      scriptId: 'customworkflow_suitelens_so_approval',
      status: 'RELEASED',
      trigger: 'BEFORESUBMIT',
      isInactive: false,
    });
    expect(items[1]?.isInactive).toBe(true);
  });

  it('maps the nodf and base variants', () => {
    expect(mapWorkflowRows(rows('automation.workflows.nodf'), 'salesorder')).toHaveLength(3);
    expect(mapWorkflowRows(rows('automation.workflows.base'), 'salesorder')).toHaveLength(2);
  });

  it('every variant selects internalid, never the missing id column', () => {
    for (const variant of WORKFLOWS_QUERY.variants) {
      expect(variant.sql).toContain('w.internalid AS id');
      expect(variant.sql).not.toMatch(/\bw\.id\b/);
    }
  });

  it('skips invalid rows and uses fallbacks', () => {
    const items = mapWorkflowRows(
      [null, { name: 'no id' }, { id: 5, recordtype: 'SALESORDER' }],
      'salesorder',
    );
    expect(items).toEqual([{ kind: 'workflow', name: '5', internalId: '5' }]);
  });
});

describe('sortAutomations', () => {
  it('orders Client → User Event → Workflow Action → Workflow, then by name', () => {
    const sorted = sortAutomations([
      { kind: 'workflow', name: 'A', internalId: '1' },
      { kind: 'user_event', name: 'B', internalId: '2' },
      { kind: 'user_event', name: 'A', internalId: '3' },
      { kind: 'workflow_action', name: 'A', internalId: '4' },
      { kind: 'client', name: 'Z', internalId: '5' },
    ]);
    expect(sorted.map((i) => i.internalId)).toEqual(['5', '3', '2', '4', '1']);
  });
});
