import type { z } from 'zod';
import { ContentResponseSchemas, type ContentRequest, type Result } from '../bridge/protocol';
import { detectFromUrl } from '../context/detect';
import { isNetSuiteUrl } from '../context/environment';
import { SuiteLensError, toSuiteLensError } from '../errors';
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
      throw new SuiteLensError('INVALID_RESPONSE', 'Unexpected response from the NetSuite page.');
    }
    if (!parsed.data.ok) throw SuiteLensError.fromShape(parsed.data.error);
    return parsed.data.data;
  }

  return {
    kind: 'live',

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

    async getAutomations(recordType) {
      const tab = await requireNetSuiteTab();
      const ctx = detectFromUrl(tab.url);
      if (!ctx) throw new SuiteLensError('NOT_NETSUITE', 'The active tab is not a NetSuite page.');
      return loadAutomations(ctx.accountId, recordType, async (queryId, variantId) =>
        request(tab.id, { op: 'runQuery', queryId, variantId }),
      );
    },
  };
}
