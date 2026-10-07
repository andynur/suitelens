import { PdfEditorRequestSchema, readPdfEditor } from '../impact/pdfEditor';
import { discoverPageSearches } from '../impact/searchDiscovery';
import {
  ImpactSourceRequestSchema,
  fileCabinetPageUrls,
  findSourceLink,
  findSourceLinkInHtml,
  SOURCE_MESSAGES,
  validateSourceContent,
  type ImpactSourceRequest,
} from '../impact/source';
import { findSavedSearchLink, ImpactSavedSearchRequestSchema } from '../impact/savedSearch';
import {
  authorizeRestlet,
  validateRestletRequest,
  type RestletRequest,
  type RestletResponse,
} from '../restlets/request';
import { readRecordPayload } from '../parsers/recordPayload';
import { validateConsoleSql, CONSOLE_ROW_LIMIT } from '../queries/console';
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
  sourceFetch?: (url: string, origin: string) => Promise<string>;
  restletFetch?: (request: RestletRequest, origin: string) => Promise<RestletResponse>;
  allowProductionWrites?: (accountId: string) => Promise<boolean>;
  doc: Document;
  getBridge: () => Promise<BridgeClient>;
  /** Same-origin GET returning text. */
  fetchText: (url: string) => Promise<string>;
  /** Outlines a field on the page; injected so this module stays free of feature code. */
  highlightField?: (fieldId: string) => boolean;
  now?: () => number;
};

const LINK_CACHE_MS = 120_000;

export function createContentService(deps: ContentServiceDeps) {
  const now = deps.now ?? Date.now;
  // In-memory only: download links carry a per-file hash that is never persisted or logged.
  const folderPages = new Map<string, { at: number; html: string }>();

  /** Falls back to File Cabinet pages when the active page has no link for the file. */
  async function resolveSourceLink(req: ImpactSourceRequest, pageUrl: string): Promise<string> {
    try {
      return findSourceLink(deps.doc, pageUrl, req);
    } catch (error) {
      if (!(error instanceof SuiteLensError) || error.code !== 'UNSUPPORTED') throw error;
    }
    for (const pageLink of fileCabinetPageUrls(pageUrl, req)) {
      const folder = pageLink.includes('mediaitemfolders.nl');
      const cached = folder ? folderPages.get(pageLink) : undefined;
      let html = cached && now() - cached.at < LINK_CACHE_MS ? cached.html : undefined;
      if (html === undefined) {
        try {
          html = await deps.fetchText(pageLink);
        } catch (error) {
          if (error instanceof SuiteLensError && error.code === 'PERMISSION_DENIED') throw error;
          continue;
        }
        if (folder) {
          if (folderPages.size >= 10) folderPages.clear();
          folderPages.set(pageLink, { at: now(), html });
        }
      }
      const link = findSourceLinkInHtml(html, pageUrl, req);
      if (link) return link;
    }
    throw new SuiteLensError('UNSUPPORTED', SOURCE_MESSAGES['no-link']);
  }

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

  async function getRecordXml(
    ref: RecordRef,
    accountId: string,
    comparison = false,
  ): Promise<string> {
    const ctx = await getPageContext();
    const requireRecord = (current: PageContext) => {
      if (current.accountId !== accountId)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed during inspection.');
      if (!isRecordPage(current) || !current.recordId || !ref.id)
        throw new SuiteLensError('NOT_A_RECORD', 'Open a saved record to inspect its XML.');
      if (
        current.recordType !== ref.recordType ||
        (!comparison && current.recordId !== ref.id) ||
        current.url !== ctx.url
      )
        throw new SuiteLensError(
          'UNSUPPORTED',
          'Only the record open in this tab can be inspected.',
        );
    };
    requireRecord(ctx);
    if (!/^\d{1,20}$/.test(ref.id!))
      throw new SuiteLensError('UNSUPPORTED', 'Enter a numeric record internal ID.');
    // VERIFY: same-type XML reads using the active endpoint with a different internal ID.
    // Preserve rectype for custom records; never accept a URL or origin from the caller.
    const url = new URL(buildRecordXmlUrl(ctx.url));
    url.searchParams.set('id', ref.id!);
    const xml = await deps.fetchText(url.href);
    requireRecord(await getPageContext());
    return readRecordPayload(xml, ref, undefined, comparison).xml;
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
        case 'callRestlet': {
          const req = validateRestletRequest(request.request);
          const ctx = await getPageContext();
          const allow = (await deps.allowProductionWrites?.(ctx.accountId)) ?? false;
          const current = await getPageContext();
          if (current.url !== ctx.url)
            throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed before execution.');
          authorizeRestlet(req, current, allow);
          if (!deps.restletFetch)
            throw new SuiteLensError('UNSUPPORTED', 'RESTlet transport unavailable.');
          const data = await deps.restletFetch(req, new URL(current.url).origin);
          if ((await getPageContext()).url !== current.url)
            throw new SuiteLensError(
              'ACCOUNT_MISMATCH',
              'Target changed during execution. Check NetSuite before retrying a write.',
            );
          return { ok: true, data };
        }
        case 'discoverImpactSavedSearches': {
          const pageUrl = deps.getUrl();
          const data = discoverPageSearches(deps.doc, pageUrl, request.request);
          if (deps.getUrl() !== pageUrl)
            throw new SuiteLensError(
              'ACCOUNT_MISMATCH',
              'Page changed during saved-search discovery.',
            );
          return { ok: true, data };
        }
        case 'readImpactSavedSearch': {
          const req = ImpactSavedSearchRequestSchema.parse(request.request);
          const pageUrl = deps.getUrl();
          if (detectFromUrl(pageUrl)?.accountId !== req.accountId)
            throw new SuiteLensError(
              'ACCOUNT_MISMATCH',
              'Account changed before the saved search read.',
            );
          const bridge = await deps.getBridge();
          if (deps.getUrl() !== pageUrl)
            throw new SuiteLensError(
              'ACCOUNT_MISMATCH',
              'Target changed before the saved search read.',
            );
          const definition = await bridge.call({
            op: 'readImpactSavedSearch',
            searchId: req.searchId,
          });
          if (deps.getUrl() !== pageUrl)
            throw new SuiteLensError(
              'ACCOUNT_MISMATCH',
              'Target changed during the saved search read.',
            );
          const objectUrl = findSavedSearchLink(deps.doc, pageUrl, definition.internalId);
          return { ok: true, data: { ...req, definition, ...(objectUrl ? { objectUrl } : {}) } };
        }
        case 'readImpactPdfEditor': {
          const req = PdfEditorRequestSchema.parse(request.request);
          const pageUrl = deps.getUrl();
          const data = readPdfEditor(deps.doc, pageUrl, req);
          if (deps.getUrl() !== pageUrl)
            throw new SuiteLensError(
              'ACCOUNT_MISMATCH',
              'Target changed during the PDF editor read.',
            );
          return { ok: true, data };
        }
        case 'readImpactSource': {
          const req: ImpactSourceRequest = ImpactSourceRequestSchema.parse(request.request);
          const pageUrl = deps.getUrl();
          if (!deps.sourceFetch)
            throw new SuiteLensError('UNSUPPORTED', 'Source transport unavailable.');
          const url = await resolveSourceLink(req, pageUrl);
          const content = await deps.sourceFetch(url, new URL(pageUrl).origin);
          if (deps.getUrl() !== pageUrl)
            throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during the source read.');
          return {
            ok: true,
            data: { ...req, url, content: validateSourceContent(content, req.source) },
          };
        }
        case 'getPageContext':
          return { ok: true, data: await getPageContext() };
        case 'getRecordXml':
          return {
            ok: true,
            data: await getRecordXml(request.ref, request.accountId, request.comparison),
          };
        case 'getRecordFields':
          return { ok: true, data: await getRecordFields(request.ref) };
        case 'runQuery':
          return { ok: true, data: await runQuery(request.queryId, request.variantId) };
        case 'runConsoleQuery': {
          validateConsoleSql(request.sql);
          const requireAccount = () => {
            if (detectFromUrl(deps.getUrl())?.accountId !== request.accountId)
              throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed during execution.');
          };
          requireAccount();
          const bridge = await deps.getBridge();
          requireAccount();
          const rows = await bridge.call(request);
          requireAccount();
          return {
            ok: true,
            data: {
              accountId: request.accountId,
              rows,
              atLimit: rows.length === CONSOLE_ROW_LIMIT,
            },
          };
        }
        case 'highlightField':
          return { ok: true, data: deps.highlightField?.(request.fieldId) ?? false };
      }
    } catch (err) {
      return { ok: false, error: toSuiteLensError(err).toShape() };
    }
  }

  return { getPageContext, getRecordFields, getRecordXml, runQuery, handle };
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
