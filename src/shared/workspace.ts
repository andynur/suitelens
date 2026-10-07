import type { PanelTab } from './store';

/**
 * Panel information architecture (ADR 0052). Two groups: tabs about the record on the page and
 * account-wide tools. Workspace roles order the tabs inside each group and pick the group that
 * opens on pages without a record. Every enabled feature stays available; tabs that do not fit
 * the panel width move into the "More" menu in this order.
 */
export const WORKSPACE_ROLES = ['developer', 'admin', 'consultant'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const RECORD_TABS = ['record', 'automation', 'inspector', 'related'] as const;
export const TOOL_TABS = ['console', 'logs', 'impact', 'restlets', 'docs'] as const;
export type RecordTab = (typeof RECORD_TABS)[number];
export type ToolTab = (typeof TOOL_TABS)[number];
export type WorkspaceTab = RecordTab | ToolTab;
export type TabGroup = 'record' | 'tools';

export const TAB_ORDER: Record<
  WorkspaceRole,
  { record: readonly RecordTab[]; tools: readonly ToolTab[] }
> = {
  developer: {
    record: ['record', 'automation', 'inspector', 'related'],
    tools: ['console', 'logs', 'impact', 'restlets', 'docs'],
  },
  admin: {
    record: ['record', 'automation', 'related', 'inspector'],
    tools: ['logs', 'impact', 'console', 'docs', 'restlets'],
  },
  consultant: {
    record: ['record', 'automation', 'related', 'inspector'],
    tools: ['impact', 'docs', 'logs', 'console', 'restlets'],
  },
};

export function tabGroup(tab: PanelTab): TabGroup | undefined {
  if ((RECORD_TABS as readonly string[]).includes(tab)) return 'record';
  if ((TOOL_TABS as readonly string[]).includes(tab)) return 'tools';
  return undefined;
}

export function isRecordTab(tab: PanelTab): tab is RecordTab {
  return tabGroup(tab) === 'record';
}
