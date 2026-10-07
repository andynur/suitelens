import { PdfEditorRequestSchema, readPdfEditor } from '../impact/pdfEditor';
import { SearchDiscoveryRequestSchema, discoverPageSearches } from '../impact/searchDiscovery';
import { ImpactSourceRequestSchema, findSourceLink, validateSourceContent } from '../impact/source';
import {
  findSavedSearchLink,
  ImpactSavedSearchRequestSchema,
  mapSavedSearchDefinition,
} from '../impact/savedSearch';
import { authorizeRestlet, validateRestletRequest } from '../restlets/request';
import {
  ConsoleResultSchema,
  validateConsoleSql,
  throwIfCancelled,
  collectConsolePages,
  validateParameters,
  CONSOLE_PAGE_SIZE,
} from '../queries/console';
import { resolveConsoleFixture } from '../queries/consoleFixtures';
import { detectFromUrl } from '../context/detect';
import { isNetSuiteUrl } from '../context/environment';
import { SuiteLensError, type ErrorCode } from '../errors';
import { mergeFieldSources, type CurrentRecordFields } from '../parsers/mergeFields';
import { readRecordPayload } from '../parsers/recordPayload';
import { parseRecordXml, type XmlParse } from '../parsers/recordXml';
import { loadAutomations } from '../queries/runner';
import type { ContentRequest } from '../bridge/protocol';
import { ContentResponseSchemas } from '../bridge/protocol';
import type { PageContext } from '../types';
import type { GetTargetTab, NetSuiteAdapter } from './NetSuiteAdapter';

/**
 * Fake NetSuite data (fixtures/**). Fake data only — never real account data.
 * Keys for records are `<recordType>-<id>`; SuiteQL rows are keyed by `<queryId>.<variantId>`.
 */
export type FixtureSet = {
  savedSearchPages?: Record<string, string>;
  impactPdfEditor?: string;
  impactSavedSearches?: Record<string, { definition: unknown; link?: string }>;
  records: Record<string, string>;
  impactSources?: Record<
    string,
    { source: 'script' | 'pdf-template'; content: string; link: string }
  >;
  currentRecords: Record<string, CurrentRecordFields>;
  suiteql: Record<string, unknown[]>;
  /** Numeric custom record type ID → script ID (what the DOM/bridge gives on live pages). */
  customRecordTypes: Record<string, string>;
};

export type FixtureAdapterOptions = {
  fixtures: FixtureSet;
  allowProductionWrites?: (accountId: string) => Promise<boolean>;
  getTargetTab: GetTargetTab;
  /** URL used when the target tab is not a NetSuite page (development without an account). */
  fallbackUrl?: string;
  latencyMs?: number;
  /** Simulate an automation query failure (error UI development). */
  failAutomations?: ErrorCode;
  xmlParse?: XmlParse;
  /**
   * Reaches the content script of the target tab for page-only effects (field highlight).
   * Data still comes from fixtures. Without it, highlightField resolves false.
   */
  sendToTab?: (tabId: number, request: ContentRequest) => Promise<unknown>;
  now?: () => number;
};

export const DEFAULT_FIXTURE_URL =
  'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';

export function createFixtureAdapter(options: FixtureAdapterOptions): NetSuiteAdapter {
  const { fixtures, latencyMs = 0, now = Date.now } = options;
  const delay = () =>
    latencyMs > 0 ? new Promise<void>((r) => setTimeout(r, latencyMs)) : Promise.resolve();

  const currentContext = async (): Promise<PageContext | null> => {
    const tab = await options.getTargetTab();
    const url = tab?.url && isNetSuiteUrl(tab.url) ? tab.url : options.fallbackUrl;
    if (!url) return null;
    const ctx = detectFromUrl(url, now());
    if (!ctx) return null;
    if (!ctx.recordType && ctx.customRecordTypeId) {
      const scriptId = fixtures.customRecordTypes[ctx.customRecordTypeId];
      if (scriptId) return { ...ctx, recordType: scriptId, recordTypeSource: 'dom' };
    }
    return ctx;
  };

  const requireContext = async (): Promise<PageContext> => {
    const ctx = await currentContext();
    if (!ctx) throw new SuiteLensError('NOT_NETSUITE', 'The active tab is not a NetSuite page.');
    return ctx;
  };

  const findKey = (map: Record<string, unknown>, recordType: string, id?: string) => {
    const exact = `${recordType}-${id ?? ''}`;
    if (exact in map) return exact;
    return Object.keys(map).find((k) => k.startsWith(`${recordType}-`));
  };

  return {
    kind: 'fixture',
    async discoverImpactSavedSearches(raw) {
      const req = SearchDiscoveryRequestSchema.parse(raw);
      const ctx = await requireContext();
      if (ctx.url !== req.pageUrl || ctx.accountId !== req.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Page changed before saved-search discovery.');
      await delay();
      const current = await requireContext();
      if (current.url !== ctx.url || current.accountId !== ctx.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Page changed during saved-search discovery.');
      const html = fixtures.savedSearchPages?.[new URL(ctx.url).pathname] ?? '';
      return discoverPageSearches(new DOMParser().parseFromString(html, 'text/html'), ctx.url, req);
    },
    async readImpactSavedSearch(raw) {
      const req = ImpactSavedSearchRequestSchema.parse(raw);
      const ctx = await requireContext();
      if (ctx.accountId !== req.accountId)
        throw new SuiteLensError(
          'ACCOUNT_MISMATCH',
          'Account changed before the saved search read.',
        );
      await delay();
      if ((await requireContext()).url !== ctx.url)
        throw new SuiteLensError(
          'ACCOUNT_MISMATCH',
          'Target changed during the saved search read.',
        );
      const fixture = fixtures.impactSavedSearches?.[req.searchId];
      if (!fixture)
        throw new SuiteLensError('UNSUPPORTED', 'No fixture definition for this saved search.');
      const definition = mapSavedSearchDefinition(fixture.definition, req.searchId);
      const doc = new DOMParser().parseFromString('<html></html>', 'text/html');
      if (fixture.link) {
        const anchor = doc.createElement('a');
        anchor.setAttribute('href', fixture.link);
        doc.body.append(anchor);
      }
      const objectUrl = findSavedSearchLink(doc, ctx.url, definition.internalId);
      return { ...req, definition, ...(objectUrl ? { objectUrl } : {}) };
    },
    async readImpactPdfEditor(raw) {
      const req = PdfEditorRequestSchema.parse(raw);
      const ctx = await requireContext();
      if (ctx.accountId !== req.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before the PDF editor read.');
      await delay();
      const current = await requireContext();
      if (current.url !== ctx.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during the PDF editor read.');
      const doc = new DOMParser().parseFromString(fixtures.impactPdfEditor ?? '', 'text/html');
      return readPdfEditor(doc, ctx.url, req);
    },
    async readImpactSource(raw) {
      const req = ImpactSourceRequestSchema.parse(raw);
      const ctx = await requireContext();
      if (ctx.accountId !== req.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before reading the source.');
      await delay();
      if ((await requireContext()).url !== ctx.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during the source read.');
      const file = fixtures.impactSources?.[req.fileId];
      if (!file || file.source !== req.source)
        throw new SuiteLensError(
          'UNSUPPORTED',
          'No fixture source for this file. The source was not checked.',
        );
      const doc = new DOMParser().parseFromString('<html></html>', 'text/html');
      const anchor = doc.createElement('a');
      anchor.setAttribute('href', file.link);
      doc.body.append(anchor);
      const url = findSourceLink(doc, ctx.url, req);
      return { ...req, url, content: validateSourceContent(file.content, req.source) };
    },
    async callRestlet(raw) {
      const req = validateRestletRequest(raw);
      const ctx = await requireContext();
      const allow = (await options.allowProductionWrites?.(ctx.accountId)) ?? false;
      authorizeRestlet(req, ctx, allow);
      await delay();
      if ((await requireContext()).url !== ctx.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during execution.');
      const body = JSON.stringify({
        fixture: true,
        method: req.method,
        script: req.script,
        deploy: req.deploy,
        params: req.params,
        body: req.body ? JSON.parse(req.body) : null,
      });
      return { status: 200, elapsedMs: 20, bytes: new TextEncoder().encode(body).length, body };
    },

    async getPageContext() {
      await delay();
      return currentContext();
    },

    async getRecordFields(ref) {
      await delay();
      const ctx = await requireContext();
      const xmlKey = findKey(fixtures.records, ref.recordType, ref.id);
      const crKey = findKey(fixtures.currentRecords, ref.recordType, ref.id);
      if (!xmlKey && !crKey) {
        throw new SuiteLensError('XML_UNAVAILABLE', `No fixture for ${ref.recordType}.`);
      }
      const xmlText = xmlKey ? fixtures.records[xmlKey] : undefined;
      const xml = xmlText ? parseRecordXml(xmlText, options.xmlParse) : undefined;
      const currentRecord = crKey ? fixtures.currentRecords[crKey] : undefined;
      const merged = mergeFieldSources({ xml, currentRecord });
      const result = {
        accountId: ctx.accountId,
        recordType: ref.recordType,
        ...merged,
        warnings: [],
        fetchedAt: now(),
      };
      return ref.id ? { ...result, recordId: ref.id } : result;
    },

    async getRecordXml(ref, accountId, readOptions) {
      const ctx = await requireContext();
      if (ctx.accountId !== accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before inspection.');
      if (!ctx.recordId || !ref.id)
        throw new SuiteLensError('NOT_A_RECORD', 'Open a saved record to inspect its XML.');
      if (
        ctx.recordType !== ref.recordType ||
        (!readOptions?.comparison && ctx.recordId !== ref.id)
      )
        throw new SuiteLensError(
          'UNSUPPORTED',
          'Only the record open in this tab can be inspected.',
        );
      if (!/^\d{1,20}$/.test(ref.id))
        throw new SuiteLensError('UNSUPPORTED', 'Enter a numeric record internal ID.');
      await delay();
      const current = await requireContext();
      if (current.accountId !== accountId || current.url !== ctx.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during inspection.');
      const xml = fixtures.records[`${ref.recordType}-${ref.id}`];
      if (!xml) throw new SuiteLensError('XML_UNAVAILABLE', 'No XML fixture for this record.');
      return readRecordPayload(xml, ref, options.xmlParse, !!readOptions?.comparison).xml;
    },

    async getAutomations(recordType) {
      await delay();
      const ctx = await requireContext();
      if (options.failAutomations) {
        throw new SuiteLensError(options.failAutomations, 'Simulated failure (fixture mode).');
      }
      return loadAutomations(
        ctx.accountId,
        recordType,
        async (queryId, variantId) => {
          const rows = fixtures.suiteql[`${queryId}.${variantId}`];
          if (!rows) {
            throw new SuiteLensError(
              'TABLE_UNAVAILABLE',
              `No fixture for ${queryId}.${variantId}.`,
            );
          }
          return rows;
        },
        now,
      );
    },

    async runSuiteQL(sql, runOptions) {
      sql = validateConsoleSql(sql);
      const params = validateParameters(sql, runOptions.params);
      return collectConsolePages(async (offset, executionSignal) => {
        throwIfCancelled(executionSignal);
        const ctx = await requireContext();
        if (ctx.accountId !== runOptions.accountId)
          throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before execution.');
        await delay();
        throwIfCancelled(executionSignal);
        if ((await requireContext()).accountId !== runOptions.accountId)
          throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed during execution.');
        const rows = resolveConsoleFixture(sql, fixtures.suiteql, params).slice(
          offset,
          offset + CONSOLE_PAGE_SIZE,
        );
        return ConsoleResultSchema.parse({ accountId: ctx.accountId, rows, atLimit: false });
      }, runOptions);
    },

    async highlightField(fieldId) {
      const tab = await options.getTargetTab();
      if (!options.sendToTab || !tab?.url || !isNetSuiteUrl(tab.url)) return false;
      const parsed = ContentResponseSchemas.highlightField.safeParse(
        await options.sendToTab(tab.id, { op: 'highlightField', fieldId }),
      );
      return parsed.success && parsed.data.ok && parsed.data.data;
    },
  };
}
