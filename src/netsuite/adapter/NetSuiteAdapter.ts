import type { AutomationResult, PageContext, RecordFieldsResult, RecordRef } from '../types';

/**
 * The only way UI code reaches NetSuite (CLAUDE.md rule 8). The UI never knows which
 * implementation it is using.
 *
 * Extended per version (runSuiteQL in v0.2, getRecordXml/callRestlet in v0.3);
 * methods are never removed without an ADR.
 */
export type NetSuiteAdapter = {
  readonly kind: 'live' | 'fixture';
  /** null when the target tab is not a NetSuite account page. */
  getPageContext(): Promise<PageContext | null>;
  getRecordFields(ref: RecordRef): Promise<RecordFieldsResult>;
  getAutomations(recordType: string): Promise<AutomationResult>;
};

/** The browser tab the adapter works against. */
export type TargetTab = { id: number; url?: string };
export type GetTargetTab = () => Promise<TargetTab | undefined>;
