import { z } from 'zod';
import { SuiteLensError } from '../errors';
import type { PageContext } from '../types';

const pairs = z
  .record(z.string().min(1).max(100), z.string().max(10000))
  .refine((v) => Object.keys(v).length <= 50);
export const RestletRequestSchema = z.object({
  accountId: z.string().regex(/^[a-z0-9_-]{1,80}$/i),
  script: z.string().regex(/^(?:[1-9]\d{0,17}|customscript_[a-z0-9_]+)$/i),
  deploy: z.string().regex(/^(?:[1-9]\d{0,17}|customdeploy_[a-z0-9_]+)$/i),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  params: pairs,
  headers: pairs,
  body: z.string().max(100000),
  confirmed: z.boolean().default(false),
});
export type RestletRequest = z.infer<typeof RestletRequestSchema>;
export const RestletResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  elapsedMs: z.number().nonnegative(),
  bytes: z.number().int().nonnegative(),
  body: z.string().max(2 * 1024 * 1024),
});
export type RestletResponse = z.infer<typeof RestletResponseSchema>;
const credential = /authorization|cookie|password|passwd|secret|token|api[-_]?key|credential/i;
export function assertNoCredentials(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoCredentials);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (credential.test(key))
        throw new SuiteLensError(
          'UNSUPPORTED',
          'Credential fields are not supported. Use the browser session only.',
        );
      assertNoCredentials(child);
    }
  }
  if (
    typeof value === 'string' &&
    /\b(?:Bearer\s+\S+|Basic\s+[A-Za-z0-9+/=]+|NLAuth\s+\S+)/i.test(value)
  )
    throw new SuiteLensError('UNSUPPORTED', 'Authentication credentials are not supported.');
}
export function validateRestletRequest(raw: unknown): RestletRequest {
  const req = RestletRequestSchema.parse(raw);
  assertNoCredentials(req.params);
  assertNoCredentials(req.headers);
  if (Object.keys(req.params).some((key) => /^(script|deploy)$/i.test(key)))
    throw new SuiteLensError('UNSUPPORTED', 'Script and deployment parameters are reserved.');
  if (
    Object.keys(req.headers).some(
      (key) =>
        !/^[a-z0-9-]+$/i.test(key) ||
        /^(host|origin|referer|content-length|connection|sec-.*|proxy-.*)$/i.test(key),
    )
  )
    throw new SuiteLensError('UNSUPPORTED', 'This header is controlled by the browser.');
  if (req.body.trim()) {
    try {
      assertNoCredentials(JSON.parse(req.body));
    } catch (error) {
      if (error instanceof SuiteLensError) throw error;
      throw new SuiteLensError('UNSUPPORTED', 'Request body must be valid JSON.');
    }
  }
  if (req.method === 'GET' && req.body.trim())
    throw new SuiteLensError('UNSUPPORTED', 'GET requests cannot have a body.');
  return req;
}
export function authorizeRestlet(req: RestletRequest, ctx: PageContext, allowProduction = false) {
  if (ctx.accountId !== req.accountId)
    throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before execution.');
  if (req.method !== 'GET') {
    if (!req.confirmed)
      throw new SuiteLensError(
        'PERMISSION_DENIED',
        'Confirm the RESTlet target and environment before sending.',
      );
    if (ctx.environment === 'unknown' || (ctx.environment !== 'sandbox' && !allowProduction))
      throw new SuiteLensError(
        'PERMISSION_DENIED',
        'Writes are blocked. Enable allow writes in production for this account in Settings.',
      );
  }
}
/** VERIFY: browser-session RESTlet access on app.netsuite.com varies by account/domain.
 * Never follow a redirect to restlets.api.netsuite.com or fall back to stored credentials. */
export async function fetchRestlet(req: RestletRequest, origin: string): Promise<RestletResponse> {
  const url = new URL('/app/site/hosting/restlet.nl', origin);
  url.searchParams.set('script', req.script);
  url.searchParams.set('deploy', req.deploy);
  for (const [key, value] of Object.entries(req.params)) url.searchParams.set(key, value);
  const start = performance.now();
  try {
    const res = await fetch(url.href, {
      method: req.method,
      credentials: 'same-origin',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...req.headers },
      body: req.method === 'GET' ? undefined : req.body || undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (
      res.status === 401 ||
      res.status === 403 ||
      /text\/html/i.test(res.headers.get('content-type') ?? '')
    )
      throw new SuiteLensError(
        'PERMISSION_DENIED',
        'Browser-session RESTlet access is unavailable. Check deployment permissions or use an external client with the authentication required by NetSuite.',
      );
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = '';
    if (reader) {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 2 * 1024 * 1024)
            throw new SuiteLensError('UNSUPPORTED', 'RESTlet response exceeds 2 MB.');
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
      } finally {
        await reader.cancel();
      }
    }
    return RestletResponseSchema.parse({
      status: res.status,
      elapsedMs: performance.now() - start,
      bytes,
      body,
    });
  } catch (error) {
    if (error instanceof SuiteLensError) throw error;
    throw new SuiteLensError(
      'UNSUPPORTED',
      'RESTlet session request failed or timed out. Cross-origin redirects are blocked; use an external authenticated client if this deployment requires another domain or authentication method.',
    );
  }
}
