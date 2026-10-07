import { expect, it, vi } from 'vitest';
import { fixtureAdapter, recordContext } from '../../test/adapters';
import { appendSearchPlan, planPageSearches } from './planPageSearches';

const context = recordContext();
const found = {
  accountId: context.accountId,
  pageUrl: context.url,
  searchIds: ['503'],
  atLimit: false,
  coverage: 'page-links-only' as const,
};

it('preserves source lines and aliases, adding each new numeric ID only once', () => {
  expect(
    appendSearchPlan('script:501\nsaved-search:503\ncustomsearch_demo_flag\nbad line', [
      '503',
      '504',
      '504',
    ]),
  ).toEqual({
    value: 'script:501\nsaved-search:503\ncustomsearch_demo_flag\nbad line\nsaved-search:504',
    added: 1,
  });
  const full = Array.from({ length: 100 }, (_, i) => `saved-search:${i + 1}`).join('\n');
  expect(appendSearchPlan(full, ['1']).added).toBe(0);
  expect(() => appendSearchPlan(full, ['101'])).toThrow('at most 100');
  expect(() => appendSearchPlan('x'.repeat(20000), ['503'])).toThrow('too long');
  expect(() => appendSearchPlan('', ['evil'])).toThrow();
});

it('only plans identities, without loading definitions, sources or queries', async () => {
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'discoverImpactSavedSearches').mockResolvedValue(found);
  const definition = vi.spyOn(adapter, 'readImpactSavedSearch');
  const source = vi.spyOn(adapter, 'readImpactSource');
  const query = vi.spyOn(adapter, 'runSuiteQL');
  expect(
    await planPageSearches(adapter, context, 'script:501', new AbortController().signal),
  ).toEqual({ value: 'script:501\nsaved-search:503', added: 1, found: 1, atLimit: false });
  expect(definition).not.toHaveBeenCalled();
  expect(source).not.toHaveBeenCalled();
  expect(query).not.toHaveBeenCalled();
});

it.each(['cancel', 'page', 'response'] as const)(
  'discards discovery after %s changes',
  async (change) => {
    const adapter = fixtureAdapter();
    const abort = new AbortController();
    vi.spyOn(adapter, 'discoverImpactSavedSearches').mockImplementation(async () => {
      if (change === 'cancel') abort.abort();
      if (change === 'page')
        vi.spyOn(adapter, 'getPageContext').mockResolvedValue({
          ...context,
          url: `${context.url}&changed=T`,
        });
      return { ...found, ...(change === 'response' ? { accountId: '999' } : {}) };
    });
    await expect(planPageSearches(adapter, context, '', abort.signal)).rejects.toMatchObject({
      code:
        change === 'cancel'
          ? 'CANCELLED'
          : change === 'response'
            ? 'INVALID_RESPONSE'
            : 'ACCOUNT_MISMATCH',
    });
  },
);
