import { PdfEditorRequestSchema, pdfEditorId, validatePdfEditorSource } from '../impact/pdfEditor';
import { SearchDiscoveryRequestSchema, validateSearchDiscovery } from '../impact/searchDiscovery';
import { ImpactSourceRequestSchema, validateSourceContent } from '../impact/source';
import { validateRestletRequest } from '../restlets/request';
import {
  validateConsoleSql,
  validateParameters,
  throwIfCancelled,
  waitForConsole,
  collectConsolePages,
} from '../queries/console';
import type { z } from 'zod';
import { ContentResponseSchemas, type ContentRequest, type Result } from '../bridge/protocol';
import { detectFromUrl } from '../context/detect';
import { isNetSuiteUrl } from '../context/environment';
import { invalidResponseError, SuiteLensError, toSuiteLensError } from '../errors';
import { loadAutomations } from '../queries/runner';
import type { NetSuiteAdapter, GetTargetTab, TargetTab } from './NetSuiteAdapter';

/**
 * Sends a content-script request for a tab and returns the raw (unvalidated) response.
 * Implemented with runtime messaging through the background (shared/messaging.ts);
 * injected so this module stays free of extension APIs.
 */
export type SendToTab = (tabId: number, request: ContentRequest) => Promise<unknown>;

type ResponseData = {
  [K in keyof typeof ContentResponseSchemas]: Extract<
    z.infer<(typeof ContentResponseSchemas)[K]>,
    { ok: true }
  >['data'];
};

export type LiveAdapterDeps = {
  getTargetTab: GetTargetTab;
  sendToTab: SendToTab;
};

export function createLiveAdapter(deps: LiveAdapterDeps): NetSuiteAdapter {
  const requireNetSuiteTab = async (): Promise<TargetTab & { url: string }> => {
    const tab = await deps.getTargetTab();
    if (!tab || !tab.url || !isNetSuiteUrl(tab.url)) {
      throw new SuiteLensError('NOT_NETSUITE', 'The active tab is not a NetSuite page.');
    }
    return { ...tab, url: tab.url };
  };

  async function request<Op extends ContentRequest['op']>(
    tabId: number,
    req: Extract<ContentRequest, { op: Op }>,
  ): Promise<ResponseData[Op]> {
    const raw = await deps.sendToTab(tabId, req);
    // Indexed access loses the per-op correlation; the cast restores it.
    const schema = ContentResponseSchemas[req.op] as unknown as z.ZodType<Result<ResponseData[Op]>>;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      if (raw == null)
        throw new SuiteLensError(
          'INVALID_RESPONSE',
          'The background returned an invalid response.',
          'No response was returned. Reload SuiteLens in chrome://extensions, then refresh the NetSuite tab and retry. An older extension component may still be running.',
        );
      throw invalidResponseError(
        'The background returned an invalid response.',
        parsed.error.issues,
      );
    }
    if (!parsed.data.ok) throw SuiteLensError.fromShape(parsed.data.error);
    return parsed.data.data;
  }

  return {
    kind: 'live',
    async discoverImpactSavedSearches(raw) {
      const req = SearchDiscoveryRequestSchema.parse(raw);
      const tab = await requireNetSuiteTab();
      if (tab.url !== req.pageUrl || detectFromUrl(tab.url)?.accountId !== req.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Page changed before saved-search discovery.');
      const data = await request(tab.id, { op: 'discoverImpactSavedSearches', request: req });
      const current = await requireNetSuiteTab();
      if (current.id !== tab.id || current.url !== tab.url)
        throw new SuiteLensError(
          'ACCOUNT_MISMATCH',
          'Target changed during saved-search discovery.',
        );
      return validateSearchDiscovery(data, req);
    },
    async readImpactSavedSearch(raw) {
      const req = ImpactSavedSearchRequestSchema.parse(raw);
      const tab = await requireNetSuiteTab();
      if (detectFromUrl(tab.url)?.accountId !== req.accountId)
        throw new SuiteLensError(
          'ACCOUNT_MISMATCH',
          'Account changed before the saved search read.',
        );
      const data = await request(tab.id, { op: 'readImpactSavedSearch', request: req });
      const current = await requireNetSuiteTab();
      if (current.id !== tab.id || current.url !== tab.url)
        throw new SuiteLensError(
          'ACCOUNT_MISMATCH',
          'Target changed during the saved search read.',
        );
      const definitionId = /^[0-9]+$/.test(req.searchId)
        ? data.definition.internalId
        : data.definition.scriptId;
      if (
        data.accountId !== req.accountId ||
        data.searchId !== req.searchId ||
        definitionId !== req.searchId ||
        (data.objectUrl && new URL(data.objectUrl).origin !== new URL(tab.url).origin)
      )
        throw new SuiteLensError(
          'INVALID_RESPONSE',
          'Saved search response does not match the request.',
        );
      return data;
    },
    async readImpactPdfEditor(raw) {
      const req = PdfEditorRequestSchema.parse(raw);
      const tab = await requireNetSuiteTab();
      if (detectFromUrl(tab.url)?.accountId !== req.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before the PDF editor read.');
      if (pdfEditorId(tab.url) !== req.editorId)
        throw new SuiteLensError('UNSUPPORTED', 'Only the active PDF editor can be read.');
      const data = await request(tab.id, { op: 'readImpactPdfEditor', request: req });
      const current = await requireNetSuiteTab();
      if (current.id !== tab.id || current.url !== tab.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during the PDF editor read.');
      return validatePdfEditorSource(data, tab.url, req);
    },
    async readImpactSource(raw) {
      const req = ImpactSourceRequestSchema.parse(raw);
      const tab = await requireNetSuiteTab();
      if (detectFromUrl(tab.url)?.accountId !== req.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before reading the source.');
      const data = await request(tab.id, { op: 'readImpactSource', request: req });
      const current = await requireNetSuiteTab();
      if (current.id !== tab.id || current.url !== tab.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during the source read.');
      if (
        data.accountId !== req.accountId ||
        data.fileId !== req.fileId ||
        data.source !== req.source ||
        new URL(data.url).origin !== new URL(tab.url).origin
      )
        throw new SuiteLensError(
          'INVALID_RESPONSE',
          'Source response does not match the requested file.',
        );
      validateSourceContent(data.content, req.source);
      return data;
    },
    async callRestlet(raw) {
      const req = validateRestletRequest(raw);
      const tab = await requireNetSuiteTab();
      if (detectFromUrl(tab.url)?.accountId !== req.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before execution.');
      const result = await request(tab.id, { op: 'callRestlet', request: req });
      const current = await requireNetSuiteTab();
      if (current.id !== tab.id || current.url !== tab.url)
        throw new SuiteLensError(
          'ACCOUNT_MISMATCH',
          'Target changed during execution. A dispatched write may already have completed; check NetSuite before retrying.',
        );
      return result;
    },

    async getPageContext() {
      const tab = await deps.getTargetTab();
      if (!tab?.url || !isNetSuiteUrl(tab.url)) return null;
      try {
        return await request(tab.id, { op: 'getPageContext' });
      } catch (err) {
        // Content script not reachable (e.g. page still loading): URL-only detection.
        if (toSuiteLensError(err).code === 'NO_CONTENT_SCRIPT')
          return detectFromUrl(tab.url) ?? null;
        throw err;
      }
    },

    async getRecordFields(ref) {
      const tab = await requireNetSuiteTab();
      return request(tab.id, { op: 'getRecordFields', ref });
    },

    async getRecordXml(ref, accountId, options) {
      const tab = await requireNetSuiteTab();
      if (detectFromUrl(tab.url)?.accountId !== accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before inspection.');
      const xml = await request(tab.id, { op: 'getRecordXml', ref, accountId, ...options });
      const current = await requireNetSuiteTab();
      if (current.id !== tab.id || current.url !== tab.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target tab changed during inspection.');
      return xml;
    },

    async getAutomations(recordType) {
      const tab = await requireNetSuiteTab();
      const ctx = detectFromUrl(tab.url);
      if (!ctx) throw new SuiteLensError('NOT_NETSUITE', 'The active tab is not a NetSuite page.');
      return loadAutomations(ctx.accountId, recordType, async (queryId, variantId) =>
        request(tab.id, { op: 'runQuery', queryId, variantId }),
      );
    },

    async runSuiteQL(sql, options) {
      sql = validateConsoleSql(sql);
      const params = validateParameters(sql, options.params);
      const tab = await waitForConsole(async (signal) => {
        throwIfCancelled(signal);
        const target = await requireNetSuiteTab();
        throwIfCancelled(signal);
        return target;
      }, options.signal);
      if (detectFromUrl(tab.url)?.accountId !== options.accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before execution.');
      return collectConsolePages(async (offset, executionSignal) => {
        throwIfCancelled(executionSignal);
        const current = await requireNetSuiteTab();
        throwIfCancelled(executionSignal);
        if (current.id !== tab.id || detectFromUrl(current.url)?.accountId !== options.accountId)
          throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target tab changed during execution.');
        return request(tab.id, {
          op: 'runConsoleQuery',
          sql,
          params,
          offset,
          accountId: options.accountId,
        });
      }, options);
    },

    async highlightField(fieldId) {
      const tab = await requireNetSuiteTab();
      return request(tab.id, { op: 'highlightField', fieldId });
    },
  };
}
import { ImpactSavedSearchRequestSchema } from '../impact/savedSearch';
