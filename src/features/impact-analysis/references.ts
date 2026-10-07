/** Local text analysis only. Reading account files belongs to NetSuiteAdapter. */
export type ReferenceSource = 'script' | 'pdf-template';
export type ReferenceHit = {
  source: ReferenceSource;
  confidence: 'possible';
  kind: 'exact-token' | 'dynamic-prefix';
  /** One-based UTF-16 line/column, matching browser editors. */
  line: number;
  column: number;
  offset: number;
  length: number;
  excerpt?: { startLine: number; lines: string[]; truncated: boolean };
};

export type ReferenceScan = {
  source: ReferenceSource;
  status: 'checked' | 'not-checked';
  reason?: 'invalid-target' | 'content-too-large' | 'match-limit';
  hits: ReferenceHit[];
  /** Even a checked text scan cannot prove an object is unused. */
  coverage: 'text-only';
};

export const REFERENCE_LIMITS = {
  characters: 2_000_000,
  hits: 1_000,
  excerptLineCharacters: 500,
} as const;
const identifierCharacter = /[a-zA-Z0-9_$]/;

/**
 * Conservative candidate finder, not a JavaScript/FreeMarker parser. All matches are
 * possible: comments, inactive code and dynamically assembled IDs must never become
 * certain usage. Escaped IDs, computed references and other unread files can be missed.
 * No code is executed, fetched, logged or persisted. Excerpts can be omitted by callers.
 */
export function scanReferences(
  content: string,
  target: string,
  source: ReferenceSource,
  options: { includeExcerpts?: boolean; excerptLimit?: number } = {},
): ReferenceScan {
  const result: ReferenceScan = { source, status: 'checked', hits: [], coverage: 'text-only' };
  if (!/^(?:[a-zA-Z_][a-zA-Z0-9_]*|[1-9][0-9]*)$/.test(target) || target.length > 128) {
    return { ...result, status: 'not-checked', reason: 'invalid-target' };
  }
  if (content.length > REFERENCE_LIMITS.characters) {
    return { ...result, status: 'not-checked', reason: 'content-too-large' };
  }

  const candidates: { offset: number; length: number; kind: ReferenceHit['kind'] }[] = [];
  let offset = content.indexOf(target);
  while (offset !== -1) {
    const before = content[offset - 1];
    const after = content[offset + target.length];
    if (
      (!before || !identifierCharacter.test(before)) &&
      (!after || !identifierCharacter.test(after))
    ) {
      candidates.push({ offset, length: target.length, kind: 'exact-token' });
      if (candidates.length > REFERENCE_LIMITS.hits) break;
    }
    offset = content.indexOf(target, offset + target.length);
  }

  // Literal prefix followed by concatenation or template interpolation. This only
  // produces candidates; it does not infer the runtime value of the expression.
  const prefixes = /(['"`])([a-zA-Z_][a-zA-Z0-9_]*)\1\s*\+|`([a-zA-Z_][a-zA-Z0-9_]*)\$\{/g;
  if (candidates.length <= REFERENCE_LIMITS.hits) {
    for (const match of content.matchAll(prefixes)) {
      const prefix = (match[2] ?? match[3])!;
      if (prefix.length >= 4 && target.startsWith(prefix) && target !== prefix) {
        candidates.push({ offset: match.index + 1, length: prefix.length, kind: 'dynamic-prefix' });
        if (candidates.length > REFERENCE_LIMITS.hits) break;
      }
    }
  }
  candidates.sort((a, b) => a.offset - b.offset);
  if (candidates.length > REFERENCE_LIMITS.hits) {
    result.status = 'not-checked';
    result.reason = 'match-limit';
    candidates.length = REFERENCE_LIMITS.hits;
  }

  // Advance through line starts once; avoid re-splitting the entire source per hit.
  const lines = content.split(/\r\n|\n|\r/);
  const starts = [0];
  for (const match of content.matchAll(/\r\n|\n|\r/g)) starts.push(match.index + match[0].length);
  let lineIndex = 0;
  for (const candidate of candidates) {
    while (lineIndex + 1 < starts.length && starts[lineIndex + 1]! <= candidate.offset) lineIndex++;
    const hit: ReferenceHit = {
      ...candidate,
      source,
      confidence: 'possible',
      line: lineIndex + 1,
      column: candidate.offset - starts[lineIndex]! + 1,
    };
    if (
      options.includeExcerpts !== false &&
      result.hits.length < (options.excerptLimit ?? REFERENCE_LIMITS.hits)
    ) {
      const first = Math.max(0, lineIndex - 3);
      const context = lines.slice(first, lineIndex + 4);
      hit.excerpt = {
        startLine: first + 1,
        lines: context.map((line) => line.slice(0, REFERENCE_LIMITS.excerptLineCharacters)),
        truncated: context.some((line) => line.length > REFERENCE_LIMITS.excerptLineCharacters),
      };
    }
    result.hits.push(hit);
  }
  return result;
}
