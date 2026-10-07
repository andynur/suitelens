import { describe, expect, it } from 'vitest';
import type { AutomationItem } from '../../netsuite/types';
import {
  EMPTY_AUTOMATION_FILTERS,
  filterAutomations,
  isExceptionalStatus,
  runningFirst,
} from './filter';

const item = (over: Partial<AutomationItem>): AutomationItem => ({
  kind: 'client',
  name: 'Script',
  internalId: '1',
  ...over,
});

const items = [
  item({ name: 'CS Approval', scriptId: 'customscript_approval_cs', internalId: '1' }),
  item({ name: 'CS Old', scriptId: 'customscript_old', isDeployed: false, internalId: '2' }),
  item({ name: 'UE Sync', scriptFileName: 'ue_sync.js', isInactive: true, internalId: '3' }),
  item({ name: 'CS Lines', deploymentId: 'customdeploy_lines', internalId: '4' }),
];

describe('filterAutomations', () => {
  it('returns everything without filters', () => {
    expect(filterAutomations(items, EMPTY_AUTOMATION_FILTERS)).toHaveLength(4);
  });

  it('matches name, script ID, deployment ID and file name', () => {
    const ids = (query: string) =>
      filterAutomations(items, { ...EMPTY_AUTOMATION_FILTERS, query }).map((i) => i.internalId);
    expect(ids('approval')).toEqual(['1']);
    expect(ids('CUSTOMDEPLOY_LINES')).toEqual(['4']);
    expect(ids('ue_sync.js')).toEqual(['3']);
  });

  it('hides undeployed and inactive items when deployedOnly is set', () => {
    const result = filterAutomations(items, { ...EMPTY_AUTOMATION_FILTERS, deployedOnly: true });
    expect(result.map((i) => i.internalId)).toEqual(['1', '4']);
  });

  it('keeps one script type when kind is set', () => {
    const mixed = [...items, item({ kind: 'workflow', name: 'WF', internalId: '9' })];
    const result = filterAutomations(mixed, { ...EMPTY_AUTOMATION_FILTERS, kind: 'workflow' });
    expect(result.map((i) => i.internalId)).toEqual(['9']);
  });
});

describe('runningFirst', () => {
  it('moves items that cannot run to the end and keeps the order otherwise', () => {
    expect(runningFirst(items).map((i) => i.internalId)).toEqual(['1', '4', '2', '3']);
  });
});

describe('isExceptionalStatus', () => {
  it('treats Released as normal', () => {
    expect(isExceptionalStatus('RELEASED')).toBe(false);
    expect(isExceptionalStatus(undefined)).toBe(false);
    expect(isExceptionalStatus('TESTING')).toBe(true);
  });
});
