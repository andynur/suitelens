import type { Environment } from '../types';

export type HostInfo = {
  accountId: string;
  environment: Environment;
};

/**
 * Parses a NetSuite UI hostname.
 *
 * - `1234567.app.netsuite.com`      → production
 * - `1234567-sb1.app.netsuite.com`  → sandbox
 * - `1234567-rp.app.netsuite.com`   → release preview (VERIFY: suffix not confirmed)
 * - `tstdrv123.app.netsuite.com`    → production (test drive accounts look like production)
 *
 * Returns undefined for any host that is not a NetSuite account UI host.
 */
const HOST_RE = /^([a-z0-9]+)(?:-(sb\d+|rp))?\.app\.netsuite\.com$/i;

export function parseNetSuiteHost(hostname: string): HostInfo | undefined {
  const match = HOST_RE.exec(hostname);
  if (!match) return undefined;
  const base = (match[1] ?? '').toLowerCase();
  const suffix = match[2]?.toLowerCase();
  if (!suffix) return { accountId: base, environment: 'production' };
  if (suffix === 'rp') return { accountId: `${base}-rp`, environment: 'release_preview' };
  return { accountId: `${base}-${suffix}`, environment: 'sandbox' };
}

export function isNetSuiteUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parseNetSuiteHost(parsed.hostname) !== undefined;
  } catch {
    return false;
  }
}

/** Account IDs are used as storage key prefixes; reject anything that could break a key. */
export function isValidAccountId(accountId: string): boolean {
  return /^[a-z0-9]+(?:-(?:sb\d+|rp))?$/.test(accountId);
}
