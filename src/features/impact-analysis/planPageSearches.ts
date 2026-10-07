import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import type { PageContext } from '../../netsuite/types';
import { SuiteLensError } from '../../netsuite/errors';
import { SavedSearchIdSchema } from '../../netsuite/impact/savedSearch';
import {
  SEARCH_DISCOVERY_LIMITS,
  validateSearchDiscovery,
} from '../../netsuite/impact/searchDiscovery';

/** Appends IDs to a draft only. Existing sources/invalid lines remain editable and unexecuted. */
export function appendSearchPlan(draft: string, ids: readonly string[]) {
  const lines = draft.split(/\r?\n/).filter((line) => line.trim());
  const existing = lines.flatMap((line) => {
    const text = line.trim();
    const id = text.startsWith('saved-search:') ? text.slice('saved-search:'.length).trim() : text;
    return SavedSearchIdSchema.safeParse(id).success &&
      (text.startsWith('saved-search:') || /^customsearch_/i.test(text))
      ? [id]
      : [];
  });
  const added = [...new Set(ids)].filter((id) => !existing.includes(id));
  if (
    added.some((id) => !SavedSearchIdSchema.safeParse(id).success) ||
    existing.length + added.length > SEARCH_DISCOVERY_LIMITS.searches
  )
    throw new SuiteLensError(
      'UNSUPPORTED',
      'The plan supports at most 100 saved searches. Remove some entries and retry.',
    );
  const value = [...lines, ...added.map((id) => `saved-search:${id}`)].join('\n');
  if (value.length > 20000)
    throw new SuiteLensError(
      'UNSUPPORTED',
      'The source plan is too long. Remove some entries and retry.',
    );
  return { value, added: added.length };
}

export async function planPageSearches(
  adapter: NetSuiteAdapter,
  context: PageContext,
  draft: string,
  signal: AbortSignal,
) {
  const check = async () => {
    if (signal.aborted) throw new SuiteLensError('CANCELLED', 'Search planning cancelled.');
    const current = await adapter.getPageContext();
    if (signal.aborted) throw new SuiteLensError('CANCELLED', 'Search planning cancelled.');
    if (current?.accountId !== context.accountId || current.url !== context.url)
      throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during search planning.');
  };
  await check();
  const request = { accountId: context.accountId, pageUrl: context.url };
  const found = validateSearchDiscovery(
    await adapter.discoverImpactSavedSearches(request),
    request,
  );
  await check();
  return {
    ...appendSearchPlan(draft, found.searchIds),
    found: found.searchIds.length,
    atLimit: found.atLimit,
  };
}
