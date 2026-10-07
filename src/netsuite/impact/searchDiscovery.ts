import { z } from 'zod';
import { detectFromUrl } from '../context/detect';
import { isValidAccountId } from '../context/environment';
import { SuiteLensError } from '../errors';
import { observedSavedSearchId } from './savedSearch';

export const SEARCH_DISCOVERY_LIMITS = { anchors: 2000, searches: 100 } as const;
export const SearchDiscoveryRequestSchema = z
  .object({
    accountId: z.string().refine(isValidAccountId),
    pageUrl: z.string().url().max(4096),
  })
  .strict();
export type SearchDiscoveryRequest = z.infer<typeof SearchDiscoveryRequestSchema>;
export const SearchDiscoverySchema = SearchDiscoveryRequestSchema.extend({
  searchIds: z
    .array(z.string().regex(/^[1-9][0-9]{0,19}$/))
    .max(SEARCH_DISCOVERY_LIMITS.searches)
    .refine((ids) => new Set(ids).size === ids.length),
  atLimit: z.boolean(),
  coverage: z.literal('page-links-only'),
}).strict();
export type SearchDiscovery = z.infer<typeof SearchDiscoverySchema>;

/** Reads link identities only, without titles, definitions, values, results or navigation.
 * VERIFY: supported definition-link shapes still need account validation. */
export function discoverPageSearches(
  doc: Document,
  pageUrl: string,
  raw: SearchDiscoveryRequest,
): SearchDiscovery {
  const request = SearchDiscoveryRequestSchema.parse(raw);
  if (pageUrl !== request.pageUrl || detectFromUrl(pageUrl)?.accountId !== request.accountId)
    throw new SuiteLensError('ACCOUNT_MISMATCH', 'Page changed before saved-search discovery.');
  const anchors = doc.querySelectorAll('a[href]');
  const ids = new Set<string>();
  let atLimit = anchors.length > SEARCH_DISCOVERY_LIMITS.anchors;
  for (let index = 0; index < Math.min(anchors.length, SEARCH_DISCOVERY_LIMITS.anchors); index++) {
    const id = observedSavedSearchId(anchors[index]!.getAttribute('href')!, pageUrl);
    if (!id || ids.has(id)) continue;
    if (ids.size === SEARCH_DISCOVERY_LIMITS.searches) {
      atLimit = true;
      break;
    }
    ids.add(id);
  }
  return { ...request, searchIds: [...ids], atLimit, coverage: 'page-links-only' };
}

export function validateSearchDiscovery(
  raw: unknown,
  request: SearchDiscoveryRequest,
): SearchDiscovery {
  const parsed = SearchDiscoverySchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.accountId !== request.accountId ||
    parsed.data.pageUrl !== request.pageUrl
  )
    throw new SuiteLensError(
      'INVALID_RESPONSE',
      'Saved-search discovery response does not match this page.',
    );
  return parsed.data;
}
