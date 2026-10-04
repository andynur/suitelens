import type { BridgeClient } from '../bridge/transport';
import type { ContentRequest, Result } from '../bridge/protocol';
import { detectFromUrl, isRecordPage, refineWithBridge, refineWithDom } from '../context/detect';
import { SuiteLensError, toSuiteLensError } from '../errors';
import { readDomSignals, readFieldLabels } from '../parsers/formDom';
import { mergeFieldSources, type CurrentRecordFields } from '../parsers/mergeFields';
import { buildRecordXmlUrl, parseRecordXml, type ParsedRecordXml } from '../parsers/recordXml';
import type { PageContext, RecordFieldsResult, RecordRef } from '../types';

/**
 * LiveAdapter, page side. Runs in the content script (ISOLATED world): reads the URL and
 * DOM, fetches record XML same-origin with the user's session, and calls the MAIN-world
 * bridge for N/* modules.
 */

export const RECORD_WARNINGS = {
  xmlUnavailable: 'record.xml_unavailable',
  currentRecordUnavailable: 'record.current_record_unavailable',
  loadedRecordUnavailable: 'record.loaded_record_unavailable',
} as const;

export type ContentServiceDeps = {
  getUrl: () => string;
  doc: Document;
  getBridge: () => Promise<BridgeClient>;
  /** Same-origin GET returning text. */
  fetchText: (url: string) => Promise<string>;
  now?: () => number;
};

export function createContentService(deps: ContentServiceDeps) {
  const now = deps.now ?? Date.now;

  async function getPageContext(): Promise<PageContext> {
    const fromUrl = detectFromUrl(deps.getUrl(), now());
    if (!fromUrl) throw new SuiteLensError('NOT_NETSUITE', 'This is not a NetSuite page.');
    let ctx = refineWithDom(fromUrl, readDomSignals(deps.doc));
    if (isRecordPage(ctx) && !ctx.recordType) {
      try {
        const bridge = await deps.getBridge();
        ctx = refineWithBridge(ctx, await bridge.call({ op: 'getRecordType' }, 5000));
      } catch {
        // Fallback only; the UI explains an unknown record type.
      }
    }
    return ctx;
  }

  async function getRecordFields(ref: RecordRef): Promise<RecordFieldsResult> {
    const ctx = await getPageContext();
    if (!isRecordPage(ctx)) throw new SuiteLensError('NOT_A_RECORD', 'This page is not a record.');
    if (ctx.recordType !== ref.recordType || (ref.id && ctx.recordId !== ref.id)) {
      // v0.1 reads the record open in the tab only.
      throw new SuiteLensError('UNSUPPORTED', 'Only the record open in this tab can be inspected.');
    }

    const warnings: string[] = [];
    let xml: ParsedRecordXml | undefined;
    if (ctx.recordId) {
      try {
        xml = parseRecordXml(await deps.fetchText(buildRecordXmlUrl(ctx.url)));
      } catch {
        warnings.push(RECORD_WARNINGS.xmlUnavailable);
      }
    }

    const domLabels = readFieldLabels(deps.doc);

    const fieldIds = unique([
      ...(xml?.fields.map((f) => f.id) ?? []),
      ...domLabels.map((l) => l.id),
    ]).slice(0, 1000);
    const sublists = (xml?.sublists ?? [])
      .slice(0, 50)
      .map((s) => ({ id: s.id, fieldIds: s.fieldIds.slice(0, 300) }));

    let currentRecord: CurrentRecordFields | undefined;
    let loadedRecord: CurrentRecordFields | undefined;
    if (ctx.pageKind === 'record_edit' || ctx.pageKind === 'record_create') {
      try {
        const bridge = await deps.getBridge();
        currentRecord = await bridge.call({ op: 'getCurrentRecordFields', fieldIds, sublists });
      } catch {
        warnings.push(RECORD_WARNINGS.currentRecordUnavailable);
      }
    } else if (ctx.recordId && /^\d+$/.test(ctx.recordId) && fieldIds.length > 0) {
      // View mode: types come from a read-only N/record.load (see bridge/handler.ts).
      try {
        const bridge = await deps.getBridge();
        loadedRecord = await bridge.call(
          {
            op: 'getLoadedRecordFields',
            recordType: ref.recordType,
            recordId: ctx.recordId,
            fieldIds,
            sublists,
          },
          15_000,
        );
      } catch {
        warnings.push(RECORD_WARNINGS.loadedRecordUnavailable);
      }
    }

    if (!xml && !currentRecord && domLabels.length === 0) {
      throw new SuiteLensError(
        'XML_UNAVAILABLE',
        'NetSuite did not return record data. You may be logged out or lack access.',
      );
    }

    const merged = mergeFieldSources({ xml, domLabels, currentRecord, loadedRecord });
    const result: RecordFieldsResult = {
      accountId: ctx.accountId,
      recordType: ref.recordType,
      ...merged,
      warnings,
      fetchedAt: now(),
    };
    if (ctx.recordId) result.recordId = ctx.recordId;
    return result;
  }

  async function runQuery(
    queryId: Extract<ContentRequest, { op: 'runQuery' }>['queryId'],
    variantId: string,
  ) {
    const bridge = await deps.getBridge();
    return bridge.call({ op: 'runSuiteQL', queryId, variantId });
  }

  /** Dispatches a validated request and always resolves to a Result. */
  async function handle(request: ContentRequest): Promise<Result<unknown>> {
    try {
      switch (request.op) {
        case 'getPageContext':
          return { ok: true, data: await getPageContext() };
        case 'getRecordFields':
          return { ok: true, data: await getRecordFields(request.ref) };
        case 'runQuery':
          return { ok: true, data: await runQuery(request.queryId, request.variantId) };
      }
    } catch (err) {
      return { ok: false, error: toSuiteLensError(err).toShape() };
    }
  }

  return { getPageContext, getRecordFields, runQuery, handle };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

const MAX_XML_BYTES = 5 * 1024 * 1024;

/** Same-origin fetch with the user's session. Never cross-origin. */
export async function fetchSameOriginText(url: string, origin: string): Promise<string> {
  if (new URL(url).origin !== origin)
    throw new SuiteLensError('UNSUPPORTED', 'Cross-origin request blocked.');
  const res = await fetch(url, { credentials: 'same-origin', redirect: 'error' });
  if (!res.ok) throw new SuiteLensError('XML_UNAVAILABLE', `NetSuite returned HTTP ${res.status}.`);
  const text = await res.text();
  if (text.length > MAX_XML_BYTES)
    throw new SuiteLensError('XML_UNAVAILABLE', 'Record XML is too large.');
  return text;
}
