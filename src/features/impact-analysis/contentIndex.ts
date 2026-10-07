import { z } from 'zod';
import { REFERENCE_LIMITS, type ReferenceHit, type ReferenceScan } from './references';

export const INDEX_LIMITS = { positions: 20_000, tokens: 5_000 } as const;
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const PositionSchema = z
  .object({
    kind: z.enum(['exact-token', 'dynamic-prefix']),
    line: z.number().int().positive(),
    column: z.number().int().positive(),
    offset: z.number().int().nonnegative().max(REFERENCE_LIMITS.characters),
    length: z.number().int().positive().max(128),
  })
  .strict();
export const ContentIndexSchema = z
  .object({
    version: z.literal(1),
    contentHash: HashSchema,
    checkedAt: z.number().nonnegative(),
    complete: z.boolean(),
    tokens: z
      .array(
        z
          .object({
            hash: HashSchema,
            positions: z.array(PositionSchema).max(INDEX_LIMITS.positions),
          })
          .strict(),
      )
      .max(INDEX_LIMITS.tokens),
  })
  .strict()
  .refine(
    (index) =>
      new Set(index.tokens.map((token) => token.hash)).size === index.tokens.length &&
      index.tokens.reduce((sum, token) => sum + token.positions.length, 0) <=
        INDEX_LIMITS.positions,
  );
export type ContentIndex = z.infer<typeof ContentIndexSchema>;

export async function hashIndexText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hashed identifier/prefix tokens and positions only. No source or snippets retained. */
export async function buildContentIndex(
  content: string,
  checkedAt: number,
  contentHash?: string,
): Promise<ContentIndex> {
  if (content.length > REFERENCE_LIMITS.characters) throw new Error('Source exceeds index limit');
  const candidates: { token: string; offset: number; kind: ReferenceHit['kind'] }[] = [];
  let complete = true;
  for (const match of content.matchAll(/[a-zA-Z0-9_$]+/g)) {
    if (!/^(?:[a-zA-Z_][a-zA-Z0-9_]*|[1-9][0-9]*)$/.test(match[0]) || match[0].length > 128)
      continue;
    if (candidates.length === INDEX_LIMITS.positions) {
      complete = false;
      break;
    }
    candidates.push({ token: match[0], offset: match.index, kind: 'exact-token' });
  }
  for (const match of content.matchAll(
    /(['"`])([a-zA-Z_][a-zA-Z0-9_]*)\1\s*\+|`([a-zA-Z_][a-zA-Z0-9_]*)\$\{/g,
  )) {
    const token = (match[2] ?? match[3])!;
    if (token.length < 4 || token.length > 128) continue;
    if (candidates.length === INDEX_LIMITS.positions) {
      complete = false;
      break;
    }
    candidates.push({ token, offset: match.index + 1, kind: 'dynamic-prefix' });
  }
  candidates.sort((a, b) => a.offset - b.offset);
  const starts = [0];
  for (const match of content.matchAll(/\r\n|\n|\r/g)) starts.push(match.index + match[0].length);
  let line = 0;
  const tokens = new Map<string, z.infer<typeof PositionSchema>[]>();
  for (const candidate of candidates) {
    if (!tokens.has(candidate.token) && tokens.size === INDEX_LIMITS.tokens) {
      complete = false;
      continue;
    }
    while (line + 1 < starts.length && starts[line + 1]! <= candidate.offset) line++;
    const positions = tokens.get(candidate.token) ?? [];
    positions.push({
      kind: candidate.kind,
      line: line + 1,
      column: candidate.offset - starts[line]! + 1,
      offset: candidate.offset,
      length: candidate.token.length,
    });
    tokens.set(candidate.token, positions);
  }
  const indexed: ContentIndex['tokens'] = [];
  // Keep hashing bounded rather than queueing thousands of WebCrypto operations at once.
  for (const [token, positions] of tokens)
    indexed.push({ hash: await hashIndexText(token), positions });
  return {
    version: 1,
    contentHash: contentHash ?? (await hashIndexText(content)),
    checkedAt,
    complete,
    tokens: indexed,
  };
}

export async function scanContentIndex(
  index: ContentIndex,
  target: string,
): Promise<ReferenceScan> {
  const empty: ReferenceScan = {
    source: 'script',
    status: 'checked',
    hits: [],
    coverage: 'text-only',
  };
  if (!/^(?:[a-zA-Z_][a-zA-Z0-9_]*|[1-9][0-9]*)$/.test(target) || target.length > 128)
    return { ...empty, status: 'not-checked', reason: 'invalid-target' };
  const exact = await hashIndexText(target);
  const prefixes = new Set<string>();
  for (let size = 4; size < target.length; size++)
    prefixes.add(await hashIndexText(target.slice(0, size)));
  const hits: ReferenceHit[] = [];
  for (const token of index.tokens) {
    for (const position of token.positions) {
      if (position.kind === 'exact-token' ? token.hash === exact : prefixes.has(token.hash))
        hits.push({ ...position, source: 'script', confidence: 'possible' });
    }
  }
  hits.sort((a, b) => a.offset - b.offset);
  return {
    ...empty,
    hits: hits.slice(0, REFERENCE_LIMITS.hits),
    ...(!index.complete || hits.length > REFERENCE_LIMITS.hits
      ? { status: 'not-checked' as const, reason: 'match-limit' as const }
      : {}),
  };
}
