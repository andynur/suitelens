import type { PdfEditorRequest, PdfEditorSource } from '../impact/pdfEditor';
import type { SearchDiscoveryRequest, SearchDiscovery } from '../impact/searchDiscovery';
import type { ImpactSource, ImpactSourceRequest } from '../impact/source';
import type { ImpactSavedSearch, ImpactSavedSearchRequest } from '../impact/savedSearch';
import type { RestletRequest, RestletResponse } from '../restlets/request';
import type { ConsoleOptions, ConsoleResult } from '../queries/console';
import type { AutomationResult, PageContext, RecordFieldsResult, RecordRef } from '../types';

/**
 * The only way UI code reaches NetSuite (CLAUDE.md rule 8). The UI never knows which
 * implementation it is using.
 *
 * Extended per version (runSuiteQL in v0.2, getRecordXml/callRestlet in v0.3);
 * methods are never removed without an ADR.
 */
export type NetSuiteAdapter = {
  /** Active editor snapshot, including unsaved edits. Memory only; no File Cabinet IDs. */
  readImpactPdfEditor(request: PdfEditorRequest): Promise<PdfEditorSource>;
  /** Definition only, no search execution/results and no persistence. */
  readImpactSavedSearch(request: ImpactSavedSearchRequest): Promise<ImpactSavedSearch>;
  /** Supported link IDs on the pinned page only. No definition read or search execution. */
  discoverImpactSavedSearches(request: SearchDiscoveryRequest): Promise<SearchDiscovery>;
  /** Reads one linked File Cabinet source. Never cached; unsupported sources are not checked. */
  readImpactSource(request: ImpactSourceRequest): Promise<ImpactSource>;
  readonly kind: 'live' | 'fixture';
  callRestlet(request: RestletRequest): Promise<RestletResponse>;
  /** null when the target tab is not a NetSuite account page. */
  getPageContext(): Promise<PageContext | null>;
  getRecordFields(ref: RecordRef): Promise<RecordFieldsResult>;
  /** Saved XML, credential fields removed; comparison permits another ID of the active type. Never cached. */
  getRecordXml(ref: RecordRef, accountId: string, options?: { comparison: true }): Promise<string>;
  getAutomations(recordType: string): Promise<AutomationResult>;
  /** One read-only query with sequential paging and a configurable row cap; results are never cached. */
  runSuiteQL(sql: string, options: ConsoleOptions): Promise<ConsoleResult>;
  /**
   * Scrolls the NetSuite page to a body field and outlines it briefly (visual only, no
   * writes). Resolves false when the field is not visible on the page.
   */
  highlightField(fieldId: string): Promise<boolean>;
};

/** The browser tab the adapter works against. */
export type TargetTab = { id: number; url?: string };
export type GetTargetTab = () => Promise<TargetTab | undefined>;
