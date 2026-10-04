/**
 * Field IDs that carry session or security tokens instead of record data. SuiteLens never
 * reads, shows or copies them (docs/security-privacy.md: no session tokens).
 *
 * Seen in a sandbox record XML: `_csrf` (CSRF token) and `_eml_nkey_` (account, user and
 * role key). Every `_`-prefixed ID is a NetSuite page internal, so the whole prefix is
 * dropped. The name pattern is a safety net for IDs not seen yet.
 */
const TOKEN_LIKE_RE = /csrf|nkey|token|session|secret|passw/i;

export function isSensitiveFieldId(id: string): boolean {
  return id.startsWith('_') || TOKEN_LIKE_RE.test(id);
}
