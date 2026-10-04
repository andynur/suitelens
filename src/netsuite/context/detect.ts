import type { PageContext, PageKind } from '../types';
import { parseNetSuiteHost } from './environment';
import { findMappingByPath, GENERIC_RECORD_PATHS } from './recordTypeMap';

/**
 * Context detection, step 1: URL parsing (preferred signal, docs/architecture.md §4).
 * Returns undefined when the URL is not a NetSuite account page.
 */
export function detectFromUrl(rawUrl: string, now: number = Date.now()): PageContext | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;
  const host = parseNetSuiteHost(url.hostname);
  if (!host) return undefined;

  const path = url.pathname.toLowerCase();
  const params = url.searchParams;
  const id = cleanId(params.get('id'));
  const base: PageContext = {
    accountId: host.accountId,
    environment: host.environment,
    pageKind: 'other',
    url: rawUrl,
    detectedAt: now,
  };

  const mapping = findMappingByPath(path);
  if (mapping) {
    return withRecord(base, recordKind(params, id), mapping.recordType, id);
  }

  if (path === GENERIC_RECORD_PATHS.customRecord) {
    const rectype = cleanId(params.get('rectype'));
    const ctx: PageContext = { ...base, pageKind: recordKind(params, id) };
    if (id) ctx.recordId = id;
    if (rectype) ctx.customRecordTypeId = rectype;
    // The script ID (customrecord_xyz) is not in the URL; DOM/bridge refine it.
    return ctx;
  }

  if (path === GENERIC_RECORD_PATHS.item || path === GENERIC_RECORD_PATHS.transaction) {
    const ctx: PageContext = { ...base, pageKind: recordKind(params, id) };
    if (id) ctx.recordId = id;
    return ctx;
  }

  return { ...base, pageKind: nonRecordKind(path) };
}

/**
 * DOM signals read by the content script. Kept as plain data so detection stays pure
 * and testable without a browser.
 */
export type DomSignals = {
  /** VERIFY: hidden input `baserecordtype` present on record forms. */
  baseRecordType?: string | null;
  /** VERIFY: hidden input `id` present on record forms. */
  recordId?: string | null;
};

/** Context detection, step 2: refine with stable DOM elements. URL values win. */
export function refineWithDom(ctx: PageContext, dom: DomSignals): PageContext {
  const next: PageContext = { ...ctx };
  const domType = cleanRecordType(dom.baseRecordType);
  const domId = cleanId(dom.recordId ?? null);

  if (!next.recordType && domType) {
    next.recordType = domType;
    next.recordTypeSource = 'dom';
  }
  if (!next.recordId && domId) next.recordId = domId;
  if (next.pageKind === 'other' && domType) {
    next.pageKind = next.recordId ? 'record_view' : 'record_create';
  }
  return next;
}

/** Context detection, step 3: page globals via the bridge (fallback only). */
export function refineWithBridge(
  ctx: PageContext,
  bridge: { recordType?: string | null; recordId?: string | null },
): PageContext {
  if (ctx.recordType) return ctx;
  const type = cleanRecordType(bridge.recordType);
  if (!type) return ctx;
  const next: PageContext = { ...ctx, recordType: type, recordTypeSource: 'bridge' };
  const id = cleanId(bridge.recordId ?? null);
  if (!next.recordId && id) next.recordId = id;
  return next;
}

export function isRecordPage(ctx: PageContext | null | undefined): boolean {
  return (
    !!ctx &&
    (ctx.pageKind === 'record_view' ||
      ctx.pageKind === 'record_edit' ||
      ctx.pageKind === 'record_create')
  );
}

function withRecord(
  base: PageContext,
  kind: PageKind,
  recordType: string,
  id: string | undefined,
): PageContext {
  const ctx: PageContext = { ...base, pageKind: kind, recordType, recordTypeSource: 'url' };
  if (id) ctx.recordId = id;
  return ctx;
}

function recordKind(params: URLSearchParams, id: string | undefined): PageKind {
  if (!id) return 'record_create';
  return params.get('e') === 'T' ? 'record_edit' : 'record_view';
}

function nonRecordKind(path: string): PageKind {
  // VERIFY: search result and saved search paths.
  if (path.endsWith('/searchresults.nl') || path.endsWith('/search/search.nl')) return 'search';
  if (path.endsWith('savedsearch.nl')) return 'search';
  if (path.endsWith('list.nl')) return 'list';
  return 'other';
}

function cleanId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^-?\d{1,18}$/.test(trimmed) ? trimmed : undefined;
}

function cleanRecordType(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_]{0,99}$/.test(trimmed) ? trimmed : undefined;
}
