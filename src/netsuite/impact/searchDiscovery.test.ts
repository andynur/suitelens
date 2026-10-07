import { expect, it, vi } from 'vitest';
import { SO_URL, readFixture } from '../../test/fixtures';
import {
  discoverPageSearches,
  validateSearchDiscovery,
  SEARCH_DISCOVERY_LIMITS,
} from './searchDiscovery';
import { createContentService } from '../adapter/contentService';
import { createLiveAdapter, type SendToTab } from '../adapter/LiveAdapter';
import { createFixtureAdapter } from '../adapter/FixtureAdapter';
import { loadFixtureSet } from '../adapter/fixtureSet';

const pageUrl = 'https://1234567-sb1.app.netsuite.com/app/common/search/searchlist.nl';
const request = { accountId: '1234567-sb1', pageUrl };
const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const link = (href: string) => `<a href="${href}">ignored title</a>`;
const valid = (id: number) => link(`/app/common/search/search.nl?id=${id}`);
const discovered = () =>
  discoverPageSearches(doc(readFixture('pages/saved-search-list.html')), pageUrl, request);

it('deduplicates supported definition links and returns only IDs with page coverage', () => {
  const result = discovered();
  expect(result).toEqual({
    ...request,
    searchIds: ['503'],
    atLimit: false,
    coverage: 'page-links-only',
  });
  expect(JSON.stringify(result)).not.toContain('Demo flagged orders');
  expect(discoverPageSearches(doc(''), pageUrl, request).searchIds).toEqual([]);
});

it.each([
  '/app/common/search/search.nl?id=503&id=504',
  '/app/common/search/search.nl?id=503&e=T&e=F',
  '/app/common/search/search.nl?id=503&e=bad',
  '/app/common/search/search.nl?id=0',
  '/app/common/search/search.nl?id=customsearch_test',
  '/app/common/search/search.nl?id=503#fragment',
  '/app/common/search/search.nl?id=503&results=T',
  '/app/common/search/searchresults.nl?searchid=503',
  // eslint-disable-next-line no-script-url -- Verifies rejection of executable link schemes.
  'javascript:void(503)',
  'https://1234567.app.netsuite.com/app/common/search/search.nl?id=503',
  'https://user:password@1234567-sb1.app.netsuite.com/app/common/search/search.nl?id=503',
  'http://1234567-sb1.app.netsuite.com/app/common/search/search.nl?id=503',
  '/app/common/search/search.nl?id=503&whence=' + 'x'.repeat(4096),
])('ignores unsafe, unrelated or ambiguous links: %s', (href) => {
  expect(discoverPageSearches(doc(link(href)), pageUrl, request).searchIds).toEqual([]);
});

it('discloses both anchor and unique-search caps, without counting duplicates against the search cap', () => {
  const atSearchLimit = Array.from({ length: SEARCH_DISCOVERY_LIMITS.searches }, (_, i) =>
    valid(i + 1),
  ).join('');
  expect(discoverPageSearches(doc(atSearchLimit + valid(1)), pageUrl, request).atLimit).toBe(false);
  expect(discoverPageSearches(doc(atSearchLimit + valid(101)), pageUrl, request)).toMatchObject({
    atLimit: true,
    searchIds: Array.from({ length: 100 }, (_, i) => String(i + 1)),
  });
  const anchors = link('/unrelated').repeat(SEARCH_DISCOVERY_LIMITS.anchors);
  expect(discoverPageSearches(doc(anchors + valid(503)), pageUrl, request)).toMatchObject({
    atLimit: true,
    searchIds: [],
  });
});

it('requires the pinned NetSuite page/account and rejects mismatched or duplicate responses', () => {
  expect(() => discoverPageSearches(doc(valid(503)), SO_URL, request)).toThrow('Page changed');
  expect(() =>
    discoverPageSearches(doc(valid(503)), pageUrl, { ...request, accountId: 'other' }),
  ).toThrow();
  expect(() => validateSearchDiscovery({ ...discovered(), pageUrl: SO_URL }, request)).toThrow(
    'response does not match',
  );
  expect(() =>
    validateSearchDiscovery({ ...discovered(), searchIds: ['503', '503'] }, request),
  ).toThrow();
  expect(() => validateSearchDiscovery({ ...discovered(), accountId: '999' }, request)).toThrow();
});

it('content discovery uses no fetch or MAIN-world bridge', async () => {
  const fetchText = vi.fn();
  const getBridge = vi.fn();
  const service = createContentService({
    getUrl: () => pageUrl,
    doc: doc(valid(503)),
    fetchText,
    getBridge,
  });
  expect(await service.handle({ op: 'discoverImpactSavedSearches', request })).toEqual({
    ok: true,
    data: discovered(),
  });
  expect(fetchText).not.toHaveBeenCalled();
  expect(getBridge).not.toHaveBeenCalled();
  expect(
    await service.handle({
      op: 'discoverImpactSavedSearches',
      request: { ...request, pageUrl: SO_URL },
    }),
  ).toMatchObject({ ok: false, error: { code: 'ACCOUNT_MISMATCH' } });
});

it('live adapter validates before sending and discards replies after target-tab changes', async () => {
  const getTargetTab = vi.fn().mockResolvedValue({ id: 3, url: pageUrl });
  const send = vi.fn<SendToTab>().mockResolvedValue({ ok: true, data: discovered() });
  const adapter = createLiveAdapter({ getTargetTab, sendToTab: send });
  await expect(
    adapter.discoverImpactSavedSearches({ ...request, pageUrl: SO_URL }),
  ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
  expect(send).not.toHaveBeenCalled();
  expect(await adapter.discoverImpactSavedSearches(request)).toEqual(discovered());
  send.mockImplementation(async () => {
    getTargetTab.mockResolvedValue({ id: 4, url: pageUrl });
    return { ok: true, data: discovered() };
  });
  await expect(adapter.discoverImpactSavedSearches(request)).rejects.toMatchObject({
    code: 'ACCOUNT_MISMATCH',
  });
});

it('fixture adapter reads the matching fake page and rejects page changes', async () => {
  let url = pageUrl;
  const getTargetTab = async () => ({ id: 1, url });
  const adapter = createFixtureAdapter({ fixtures: loadFixtureSet(), getTargetTab });
  expect(await adapter.discoverImpactSavedSearches(request)).toEqual(discovered());
  url = SO_URL;
  await expect(adapter.discoverImpactSavedSearches(request)).rejects.toMatchObject({
    code: 'ACCOUNT_MISMATCH',
  });
  expect(
    (await adapter.discoverImpactSavedSearches({ ...request, pageUrl: url })).searchIds,
  ).toEqual([]);
});
