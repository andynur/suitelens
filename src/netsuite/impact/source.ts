import { z } from 'zod';
import { SuiteLensError, type ErrorCode } from '../errors';
import { detectFromUrl } from '../context/detect';

export const SOURCE_LIMITS = {
  bytes: 2_000_000,
  characters: 2_000_000,
  timeoutMs: 15_000,
} as const;
export const ImpactSourceRequestSchema = z.object({
  accountId: z.string().min(1).max(100),
  fileId: z.string().regex(/^[1-9][0-9]{0,19}$/),
  source: z.enum(['script', 'pdf-template']),
  /** Optional File Cabinet folder ID, used only to find the file's download link. */
  folderId: z
    .string()
    .regex(/^-?[1-9][0-9]{0,19}$/)
    .optional(),
});
export type ImpactSourceRequest = z.infer<typeof ImpactSourceRequestSchema>;
export const ImpactSourceSchema = ImpactSourceRequestSchema.extend({
  url: z.string().url().max(4096),
  content: z.string().max(SOURCE_LIMITS.characters),
});
export type ImpactSource = z.infer<typeof ImpactSourceSchema>;

/**
 * Why one source could not be read. The error code alone (mostly `INVALID_RESPONSE`) does not
 * say which step failed, and raw error text is never stored, so failures are classified into
 * this closed set instead. Messages are authored here and matched back by identity.
 */
export const SOURCE_MESSAGES = {
  'no-link':
    'No download link for this file was found in the File Cabinet. The source was not checked.',
  'not-text': 'NetSuite did not return readable source text. The source was not checked.',
  'html-page': 'NetSuite returned an HTML page. The source was not checked.',
  'not-pdf-xml':
    'Only File Cabinet XML PDF template source is supported. The source was not checked.',
  'too-large': 'Source file is too large. The source was not checked.',
  empty: 'Source response is empty.',
  unreadable: 'Could not read source text. The source was not checked.',
  timeout: 'Source read timed out. The source was not checked.',
  permission: 'NetSuite denied access to this file. The source was not checked.',
} as const;
/** HTTP failures carry a status, so they are classified from it rather than from a message. */
const HTTP_FAILURE_KINDS = ['not-found', 'throttled', 'server-error', 'http-error'] as const;
export type SourceFailureKind = keyof typeof SOURCE_MESSAGES | (typeof HTTP_FAILURE_KINDS)[number];
export const SourceFailureKindSchema = z.enum([
  ...(Object.keys(SOURCE_MESSAGES) as [keyof typeof SOURCE_MESSAGES]),
  ...HTTP_FAILURE_KINDS,
]);
const HTTP_FAILURE_PREFIX = 'Source request returned HTTP ';

/**
 * Failures that repeat for the same file until it changes. A bundle-owned script, for example,
 * answers `500` to every download attempt (observed in one sandbox; VERIFY elsewhere).
 */
export const PERMANENT_FAILURES: ReadonlySet<SourceFailureKind> = new Set([
  'no-link',
  'not-found',
  'server-error',
  'permission',
  'not-pdf-xml',
  'too-large',
]);

function httpFailureKind(status: number): SourceFailureKind {
  if (status === 404) return 'not-found';
  if (status === 429) return 'throttled';
  if (status >= 500) return 'server-error';
  return 'http-error';
}

/** Classifies a source read failure; `undefined` when the error came from elsewhere. */
export function sourceFailureKind(error: unknown): SourceFailureKind | undefined {
  if (!(error instanceof SuiteLensError)) return undefined;
  if (error.message.startsWith(HTTP_FAILURE_PREFIX))
    return httpFailureKind(Number.parseInt(error.message.slice(HTTP_FAILURE_PREFIX.length), 10));
  for (const [kind, message] of Object.entries(SOURCE_MESSAGES))
    if (error.message === message) return kind as SourceFailureKind;
  return undefined;
}

const sourceError = (kind: keyof typeof SOURCE_MESSAGES, code: ErrorCode) =>
  new SuiteLensError(code, SOURCE_MESSAGES[kind]);

/** True for a same-origin `media.nl` link for exactly this file, with only known parameters. */
function isSourceUrl(url: URL, page: URL, request: ImpactSourceRequest): boolean {
  return (
    url.protocol === 'https:' &&
    url.origin === page.origin &&
    !url.username &&
    !url.password &&
    url.pathname === '/core/media/media.nl' &&
    !url.hash &&
    url.href.length <= 4096 &&
    url.searchParams.getAll('id').length === 1 &&
    url.searchParams.get('id') === request.fileId &&
    [...url.searchParams.keys()].every((key) => ['id', 'c', 'h', '_xt'].includes(key)) &&
    url.searchParams.getAll('c').length <= 1 &&
    (!url.searchParams.has('c') ||
      url.searchParams.get('c')?.toLowerCase().replaceAll('_', '-') === request.accountId)
  );
}

/** Validate an observed download URL for transient display; never persist its download hash. */
export function sourceDisplayLink(
  observedUrl: string,
  pageUrl: string,
  request: ImpactSourceRequest,
): string | undefined {
  try {
    requireAccount(pageUrl, request);
    const url = new URL(observedUrl);
    return isSourceUrl(url, new URL(pageUrl), request) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function requireAccount(pageUrl: string, request: ImpactSourceRequest) {
  if (detectFromUrl(pageUrl)?.accountId !== request.accountId)
    throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before reading the source.');
}

const notLinked = () =>
  new SuiteLensError(
    'UNSUPPORTED',
    'Open a File Cabinet page with a download link for this file. The source was not checked.',
  );

/** Never construct a download URL or accept arbitrary caller URLs. */
export function findSourceLink(
  doc: Document,
  pageUrl: string,
  request: ImpactSourceRequest,
): string {
  const page = new URL(pageUrl);
  requireAccount(pageUrl, request);
  // VERIFY: media.nl download links and parameters vary by account. Only links actually
  // present in this page are candidates; no guessed template or File Cabinet endpoint.
  for (const anchor of doc.querySelectorAll('a[href]')) {
    try {
      const url = new URL(anchor.getAttribute('href')!, pageUrl);
      if (isSourceUrl(url, page, request)) return url.href;
    } catch {
      /* Ignore malformed page links. */
    }
  }
  throw notLinked();
}

/** File Cabinet pages that list a file's download link (same-origin, GET, read-only). */
export function fileCabinetPageUrls(pageUrl: string, request: ImpactSourceRequest): string[] {
  const origin = new URL(pageUrl).origin;
  return [
    ...(request.folderId
      ? [`${origin}/app/common/media/mediaitemfolders.nl?folder=${request.folderId}`]
      : []),
    `${origin}/app/common/media/mediaitem.nl?id=${request.fileId}`,
  ];
}

/**
 * Finds `media.nl` links for the requested file inside File Cabinet page HTML. The HTML is
 * scanned as text only (never parsed into the live DOM) and each candidate passes the same
 * validation as an on-page link. The hash parameter is never stored or logged.
 */
export function findSourceLinkInHtml(
  html: string,
  pageUrl: string,
  request: ImpactSourceRequest,
): string | undefined {
  const page = new URL(pageUrl);
  requireAccount(pageUrl, request);
  // The candidate must start a quoted attribute value; the origin check happens in isSourceUrl.
  for (const match of html.matchAll(
    /(?<=["'])(?:https:\/\/[^"'\s<>/\\]{1,255})?\/core\/media\/media\.nl\?[^"'\s<>\\]{1,2000}/g,
  )) {
    try {
      const url = new URL(match[0].replaceAll('&amp;', '&'), page.origin);
      if (isSourceUrl(url, page, request)) return url.href;
    } catch {
      /* Ignore malformed candidates. */
    }
  }
  return undefined;
}

export function validateSourceContent(
  content: string,
  source: ImpactSourceRequest['source'],
): string {
  if (
    !content.trim() ||
    content.length > SOURCE_LIMITS.characters ||
    content.includes('\0') ||
    /^\s*(?:<!doctype\s+html|<html\b)/i.test(content) ||
    /^\s*%PDF-/.test(content)
  )
    throw sourceError('not-text', 'INVALID_RESPONSE');
  const root = content.replace(
    /^\s*(?:(?:<\?xml[^>]*>|<!--[\s\S]*?-->|<!DOCTYPE\s+pdf[^>]*>)\s*)*/i,
    '',
  );
  if (/^(?:<!doctype\s+html|<html\b)/i.test(root))
    throw sourceError('html-page', 'INVALID_RESPONSE');
  // VERIFY: exported Advanced PDF templates use an XML <pdf> root. Other formats stay unsupported.
  if (source === 'pdf-template' && !/^<pdf[\s>]/i.test(root))
    throw sourceError('not-pdf-xml', 'UNSUPPORTED');
  return content;
}

/** Bounded, read-only transport. No redirects, execution, logging or persistence. */
export async function fetchImpactSource(url: string, origin: string): Promise<string> {
  if (new URL(url).origin !== origin || new URL(url).protocol !== 'https:')
    throw new SuiteLensError('UNSUPPORTED', 'Cross-origin source request blocked.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_LIMITS.timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403)
      throw sourceError('permission', 'PERMISSION_DENIED');
    if (!response.ok)
      throw new SuiteLensError(
        'INVALID_RESPONSE',
        `${HTTP_FAILURE_PREFIX}${response.status}. The source was not checked.`,
      );
    if (Number(response.headers.get('content-length')) > SOURCE_LIMITS.bytes)
      throw sourceError('too-large', 'UNSUPPORTED');
    if (!response.body) throw sourceError('empty', 'INVALID_RESPONSE');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let content = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > SOURCE_LIMITS.bytes)
        throw new SuiteLensError(
          'UNSUPPORTED',
          'Source file is too large. The source was not checked.',
        );
      content += decoder.decode(chunk.value, { stream: true });
    }
    return content + decoder.decode();
  } catch (error) {
    if (controller.signal.aborted) throw sourceError('timeout', 'TIMEOUT');
    if (error instanceof SuiteLensError) throw error;
    throw sourceError('unreadable', 'INVALID_RESPONSE');
  } finally {
    clearTimeout(timer);
    if (reader) {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}
