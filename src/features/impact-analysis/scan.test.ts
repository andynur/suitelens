import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { createFixtureAdapter } from '../../netsuite/adapter/FixtureAdapter';
import { SuiteLensError } from '../../netsuite/errors';
import { SOURCE_MESSAGES, type ImpactSource } from '../../netsuite/impact/source';
import { createMetadataCache } from '../../shared/storage/cache';
import { readFixture, SO_URL } from '../../test/fixtures';
import { createImpactScanner, type ImpactScanPlan, type ImpactScanProgress } from './scan';

const plan: ImpactScanPlan = {
  accountId: '1234567-sb1',
  target: 'custbody_demo_flag',
  files: [
    { fileId: '501', source: 'script' },
    { fileId: '502', source: 'pdf-template' },
  ],
};
let dbNumber = 0;
function setup() {
  let url = SO_URL;
  const adapter = createFixtureAdapter({
    getTargetTab: async () => ({ id: 1, url }),
    fixtures: {
      records: {},
      currentRecords: {},
      suiteql: {},
      customRecordTypes: {},
      impactSavedSearches: {
        '503': {
          definition: JSON.parse(readFixture('impact-analysis/saved-search.json')),
          link: '/app/common/search/search.nl?id=503',
        },
      },
      impactSources: {
        '501': {
          source: 'script',
          content: readFixture('impact-analysis/user-event.js'),
          link: '/core/media/media.nl?id=501&h=fake-secret',
        },
        '502': {
          source: 'pdf-template',
          content: readFixture('impact-analysis/invoice-template.xml'),
          link: '/core/media/media.nl?id=502',
        },
      },
    },
  });
  const readOriginal = adapter.readImpactSource.bind(adapter);
  const read = vi.spyOn(adapter, 'readImpactSource');
  const cache = createMetadataCache({ dbName: `impact-scan-${++dbNumber}` });
  const set = vi.spyOn(cache, 'set');
  const scanner = createImpactScanner(adapter, cache);
  return {
    adapter,
    readOriginal,
    read,
    cache,
    set,
    scanner,
    navigate: (value: string) => {
      url = value;
    },
  };
}
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
afterEach(() => vi.useRealTimers());

describe('incremental linked-source scans', () => {
  it('finds one field across UE, PDF and saved search with source locations and transient file links', async () => {
    const { scanner, set, adapter, cache } = setup();
    const combined = { ...plan, searches: ['503'] };
    const result = await scanner.run(combined);
    expect(result.status).toBe('complete');
    for (const [index, source, fileId, line] of [
      [0, 'script', '501', 5],
      [1, 'pdf-template', '502', 5],
    ] as const) {
      expect(result.results[index]).toMatchObject({
        fileId,
        source,
        status: 'checked',
        sourceUrl: expect.stringContaining(`/core/media/media.nl?id=${fileId}`),
        hits: expect.arrayContaining([
          expect.objectContaining({ source, kind: 'exact-token', line, confidence: 'possible' }),
        ]),
      });
    }
    expect(result.searchResults[0]).toMatchObject({
      searchId: '503',
      status: 'checked',
      title: 'Demo flagged orders',
      objectUrl: 'https://1234567-sb1.app.netsuite.com/app/common/search/search.nl?id=503',
      hits: expect.arrayContaining([
        expect.objectContaining({ area: 'filter', member: 1, part: 'name' }),
      ]),
    });
    expect(JSON.stringify(set.mock.calls)).not.toContain('fake-secret');
    expect(JSON.stringify(set.mock.calls)).not.toContain('sourceUrl');
    const restored = await createImpactScanner(adapter, cache).run(combined);
    expect(restored.results.every((file) => file.sourceUrl === undefined)).toBe(true);
    expect(restored.results.map((file) => file.hits)).toEqual(
      result.results.map((file) => file.hits.map(({ excerpt: _excerpt, ...position }) => position)),
    );
    const refreshed = await scanner.run(combined, { refresh: true });
    expect(refreshed.results.every((file) => file.sourceUrl)).toBe(true);
  });

  it('reuses account/adapter/file-scoped token indexes across identifiers without reads; refresh checks changed text', async () => {
    const { scanner, read, set, cache, adapter } = setup();
    const scriptPlan = { ...plan, files: [plan.files[0]!] };
    await scanner.run(scriptPlan, { cacheIndex: true });
    const reused = await scanner.run(
      { ...scriptPlan, target: 'beforeSubmit' },
      { cacheIndex: true },
    );
    expect(reused.results[0]).toMatchObject({ fromIndex: true, status: 'checked' });
    expect(reused.results[0]!.hits.length).toBeGreaterThan(0);
    expect(read).toHaveBeenCalledTimes(1);
    const stored = JSON.stringify(set.mock.calls.filter((call) => call[1] === 'impact-index'));
    for (const text of [
      'custbody',
      'getValue',
      'define',
      'content"',
      'N/record',
      'fake-secret',
      'excerpt',
    ])
      expect(stored).not.toContain(text);
    read.mockResolvedValueOnce({
      ...plan.files[0]!,
      accountId: plan.accountId,
      url: SO_URL,
      content: 'const changed_field = 1;',
    });
    const refreshed = await scanner.run(scriptPlan, { cacheIndex: true, refresh: true });
    expect(refreshed.results[0]!.hits).toEqual([]);
    const newTarget = await createImpactScanner(adapter, cache).run(
      { ...scriptPlan, target: 'changed_field' },
      { cacheIndex: true },
    );
    expect(newTarget.results[0]!.hits).toHaveLength(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('checks fresh inventory before reusing indexes and bypasses old scan checkpoints', async () => {
    const { scanner, read, readOriginal } = setup();
    const scriptPlan = { ...plan, files: [plan.files[0]!] };
    const inventory = [
      { fileId: '501', name: 'ue.js', size: 123, modified: '2026-10-05 10:00:00' },
    ];
    await scanner.run(scriptPlan, { cacheIndex: true, inventory });
    const unchanged = await scanner.run(scriptPlan, { cacheIndex: true, inventory });
    expect(read).toHaveBeenCalledTimes(1);
    expect(unchanged.results[0]).toMatchObject({ fromIndex: true, status: 'checked' });
    expect(unchanged.results[0]!.dependencies).toBeUndefined();
    expect(unchanged.results[0]!.hits.every((hit) => !hit.excerpt)).toBe(true);

    read.mockResolvedValueOnce({
      ...(await readOriginal({ ...plan.files[0]!, accountId: plan.accountId })),
      content: 'no references',
    });
    const changed = await scanner.run(scriptPlan, {
      cacheIndex: true,
      inventory: [{ ...inventory[0]!, modified: '2026-10-05 10:01:00' }],
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(changed.results[0]!.hits).toEqual([]);
    expect(changed.results[0]!.fromIndex).toBeUndefined();

    await scanner.run(scriptPlan, {
      cacheIndex: true,
      inventory: [{ ...inventory[0]!, modified: '2026-10-05 10:01:00', size: 124 }],
    });
    expect(read).toHaveBeenCalledTimes(3);
    await scanner.run(scriptPlan, { cacheIndex: true, inventory });
    expect(read).toHaveBeenCalledTimes(4);
    await scanner.run(scriptPlan, { cacheIndex: true, inventory, refresh: true });
    expect(read).toHaveBeenCalledTimes(5);
  });

  it.each(
    [
      [],
      [{ fileId: '501', name: 'ue.js' }],
      [{ fileId: '501', name: 'ue.js', size: 123 }],
      [{ fileId: '501', name: 'ue.js', modified: '2026-10-05' }],
      [{ fileId: '501', name: 'ue.js', size: 123, modified: '  ' }],
    ].map((inventory) => ({ inventory })),
  )('rereads when fresh inventory lacks a usable revision: %j', async ({ inventory }) => {
    const { scanner, read } = setup();
    const scriptPlan = { ...plan, files: [plan.files[0]!] };
    await scanner.run(scriptPlan, { cacheIndex: true });
    await scanner.run(scriptPlan, { cacheIndex: true, inventory });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not skip reads with inventory when account indexing is disabled', async () => {
    const { scanner, read } = setup();
    const scriptPlan = { ...plan, files: [plan.files[0]!] };
    const inventory = [{ fileId: '501', name: 'ue.js', size: 123, modified: '2026-10-05' }];
    await scanner.run(scriptPlan, { cacheIndex: true, inventory });
    await scanner.run(scriptPlan, { cacheIndex: false, inventory });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('disables index reads/writes and handles expiry, corruption and cache failures', async () => {
    const { scanner, read, set, cache } = setup();
    const scriptPlan = { ...plan, files: [plan.files[0]!] };
    await scanner.run(scriptPlan, { cacheIndex: true });
    await scanner.run({ ...scriptPlan, target: 'beforeSubmit' });
    expect(read).toHaveBeenCalledTimes(2);
    await cache.clearKind(plan.accountId, 'impact-index');
    await scanner.run({ ...scriptPlan, target: 'context' }, { cacheIndex: true });
    expect(read).toHaveBeenCalledTimes(3);
    const indexCall = set.mock.calls.find((call) => call[1] === 'impact-index')!;
    await cache.set(plan.accountId, 'impact-index', indexCall[2], { content: 'corrupt' });
    await scanner.run({ ...scriptPlan, target: 'order' }, { cacheIndex: true });
    expect(read).toHaveBeenCalledTimes(4);
    vi.spyOn(cache, 'get').mockRejectedValue(new Error('offline'));
    const result = await scanner.run(scriptPlan, { cacheIndex: true });
    expect(result.cacheAvailable).toBe(false);
    expect(result.results[0]!.status).toBe('checked');
  });
  it('scans fake UE/PDF sources with progress, and caches only bounded positions', async () => {
    const { scanner, read, set, adapter, cache } = setup();
    const progress: ImpactScanProgress[] = [];
    const result = await scanner.run(plan, { onProgress: (value) => progress.push(value) });
    expect(result).toMatchObject({
      status: 'complete',
      coverage: 'supplied-files-only',
      cacheAvailable: true,
    });
    expect(progress.map((value) => value.results.length)).toEqual([0, 1, 2]);
    expect(result.results.map((value) => value.status)).toEqual(['checked', 'checked']);
    expect(result.results.every((value) => value.hits.length > 0)).toBe(true);
    expect(
      result.results.flatMap((value) => value.hits).every((hit) => hit.confidence === 'possible'),
    ).toBe(true);
    const stored = JSON.stringify(set.mock.calls);
    for (const forbidden of [
      'dependencies',
      'N/record',
      'excerpt',
      'content',
      'fake-secret',
      'define(',
      '<pdf',
      'media.nl',
    ])
      expect(stored).not.toContain(forbidden);
    const restored = await createImpactScanner(adapter, cache).run(plan);
    expect(result.results[0]!.hits[0]!.excerpt).toMatchObject({ startLine: 2 });
    expect(result.results[0]!.hits[0]!.excerpt!.lines).toHaveLength(7);
    expect(result.results[1]!.hits.every((hit) => !hit.excerpt)).toBe(true);
    expect(restored).toEqual({
      ...result,
      results: result.results.map(
        ({ dependencies: _dependencies, sourceUrl: _sourceUrl, ...file }) => ({
          ...file,
          hits: file.hits.map(({ excerpt: _excerpt, ...position }) => position),
        }),
      ),
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.results[0]!.dependencies).toMatchObject({
      status: 'checked',
      declarations: [{ modules: [{ id: 'N/record' }] }],
    });
  });

  it.each([false, true])(
    'cancels after a checkpoint and resumes in a new runner (inventory: %s)',
    async (withInventory) => {
      const { scanner, adapter, cache, read } = setup();
      const controller = new AbortController();
      const inventory = withInventory
        ? [{ fileId: '501', name: 'ue.js', size: 123, modified: '2026-10-05' }]
        : undefined;
      const cancelled = await scanner.run(plan, {
        inventory,
        signal: controller.signal,
        onProgress: (value) => {
          if (value.results.length === 1) controller.abort();
        },
      });
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.results).toHaveLength(1);
      expect(read).toHaveBeenCalledTimes(1);
      const completed = await createImpactScanner(adapter, cache).run(plan, {
        inventory,
        resume: true,
      });
      expect(completed.results).toHaveLength(2);
      const {
        dependencies: _dependencies,
        sourceUrl: _sourceUrl,
        ...cancelledFile
      } = cancelled.results[0]!;
      expect(completed.results[0]).toEqual({
        ...cancelledFile,
        hits: cancelled.results[0]!.hits.map(({ excerpt: _excerpt, ...position }) => position),
      });
      expect(read.mock.calls.map(([request]) => request.fileId)).toEqual(['501', '502']);
    },
  );

  it('releases Cancel immediately, discards late replies and drains before resuming', async () => {
    const { scanner, read } = setup();
    const pending = deferred<ImpactSource>();
    const started = deferred<void>();
    read.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    const controller = new AbortController();
    const running = scanner.run(plan, { signal: controller.signal });
    await started.promise;
    await expect(scanner.run(plan)).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    controller.abort();
    expect(await running).toMatchObject({ status: 'cancelled', results: [] });
    const resumed = scanner.run(plan);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(read).toHaveBeenCalledTimes(1);
    pending.resolve({
      ...plan.files[0]!,
      accountId: plan.accountId,
      url: SO_URL,
      content: 'late reply',
    });
    const result = await resumed;
    expect(result.status).toBe('complete');
    expect(read.mock.calls.map(([request]) => request.fileId)).toEqual(['501', '501', '502']);
    expect(result.results[0]!.hits.length).toBeGreaterThan(0);
  });

  it('keeps permission and unknown failures explicitly not checked, with no raw error stored', async () => {
    const { scanner, read, set } = setup();
    read.mockRejectedValueOnce(new SuiteLensError('PERMISSION_DENIED', 'private response'));
    read.mockRejectedValueOnce(new Error('another private response'));
    const result = await scanner.run(plan);
    expect(result.results.map((value) => [value.status, value.reason])).toEqual([
      ['not-checked', 'PERMISSION_DENIED'],
      ['not-checked', 'INVALID_RESPONSE'],
    ]);
    expect(JSON.stringify(set.mock.calls)).not.toContain('private response');
    expect(result.results.every((value) => value.failure === undefined)).toBe(true);
  });

  it('classifies which read step failed without storing the error text', async () => {
    const { scanner, read, set } = setup();
    read.mockRejectedValueOnce(new SuiteLensError('UNSUPPORTED', SOURCE_MESSAGES['no-link']));
    read.mockRejectedValueOnce(
      new SuiteLensError('INVALID_RESPONSE', SOURCE_MESSAGES['html-page']),
    );
    const result = await scanner.run(plan);
    expect(result.results.map((value) => value.failure)).toEqual(['no-link', 'html-page']);
    expect(JSON.stringify(set.mock.calls)).not.toContain('File Cabinet');
  });

  it('never rereads a permanently failing file for a later target, but refresh retries it', async () => {
    const { scanner, read } = setup();
    const scriptPlan = { ...plan, files: [plan.files[0]!] };
    // A bundle-owned script answers 500 to every download attempt.
    read.mockRejectedValue(
      new SuiteLensError('INVALID_RESPONSE', 'Source request returned HTTP 500. Not checked.'),
    );
    const first = await scanner.run(scriptPlan, { cacheIndex: true });
    expect(first.results[0]).toMatchObject({ status: 'not-checked', failure: 'server-error' });
    expect(read).toHaveBeenCalledTimes(1);

    const later = await scanner.run(
      { ...scriptPlan, target: 'custbody_other' },
      { cacheIndex: true },
    );
    expect(later.results[0]).toMatchObject({ status: 'not-checked', failure: 'server-error' });
    expect(read).toHaveBeenCalledTimes(1);

    await scanner.run(scriptPlan, { cacheIndex: true, refresh: true });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('retries a transient failure on the next target', async () => {
    const { scanner, read } = setup();
    const scriptPlan = { ...plan, files: [plan.files[0]!] };
    read.mockRejectedValueOnce(new SuiteLensError('TIMEOUT', SOURCE_MESSAGES.timeout));
    await scanner.run(scriptPlan, { cacheIndex: true });
    await scanner.run({ ...scriptPlan, target: 'custbody_other' }, { cacheIndex: true });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('rejects a changed account before even returning cached positions', async () => {
    const { scanner, navigate, read } = setup();
    await scanner.run(plan);
    navigate(SO_URL.replace('1234567-sb1', '9999999'));
    await expect(scanner.run(plan)).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('discards a reply after same-account navigation, without checkpointing it', async () => {
    const { scanner, read, readOriginal, navigate, set } = setup();
    const original = readOriginal;
    read.mockImplementationOnce(async (request) => {
      const source = await original(request);
      navigate(SO_URL + '&changed=T');
      return source;
    });
    await expect(scanner.run(plan)).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect(set).not.toHaveBeenCalled();
  });

  it('rejects a foreign-account reply and marks wrong-file replies not checked', async () => {
    const { scanner, read, set } = setup();
    const source = {
      ...plan.files[0]!,
      accountId: plan.accountId,
      url: SO_URL,
      content: 'custbody_demo_flag',
    };
    read.mockResolvedValueOnce({ ...source, accountId: '9999999' });
    await expect(scanner.run(plan)).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect(set).not.toHaveBeenCalled();
    read.mockResolvedValueOnce({ ...source, fileId: '999' });
    const result = await scanner.run({ ...plan, files: [plan.files[0]!] });
    expect(result.results[0]).toMatchObject({
      status: 'not-checked',
      reason: 'INVALID_RESPONSE',
      hits: [],
    });
  });

  it('isolates target, file plan, adapter mode and account; refresh rereads completed files', async () => {
    const { scanner, adapter, cache, read, navigate } = setup();
    await scanner.run({ ...plan, files: [plan.files[0]!] });
    await scanner.run({ ...plan, target: 'another_field', files: [plan.files[0]!] });
    await scanner.run(plan);
    await scanner.run(plan, { refresh: true });
    const live = { ...adapter, kind: 'live' } as NetSuiteAdapter;
    await createImpactScanner(live, cache).run({ ...plan, files: [plan.files[0]!] });
    navigate(SO_URL.replace('1234567-sb1', '1234567'));
    await scanner.run({ ...plan, accountId: '1234567', files: [plan.files[0]!] });
    expect(read).toHaveBeenCalledTimes(8);
  });

  it('ignores corrupt and mismatched checkpoints, and exposes persistence failures', async () => {
    const { scanner, cache, read, set } = setup();
    const get = vi.spyOn(cache, 'get');
    get.mockResolvedValueOnce({ value: { content: 'not a checkpoint' }, storedAt: 0 });
    await scanner.run(plan);
    const checkpoint = structuredClone(set.mock.calls.at(-1)![3]) as { plan: ImpactScanPlan };
    checkpoint.plan.accountId = 'another';
    get.mockResolvedValueOnce({ value: checkpoint, storedAt: 0 });
    await scanner.run(plan);
    expect(read).toHaveBeenCalledTimes(4);
    get.mockRejectedValueOnce(new Error('storage unavailable'));
    set.mockRejectedValue(new Error('storage unavailable'));
    expect(await scanner.run(plan)).toMatchObject({ status: 'complete', cacheAvailable: false });
  });

  it('rejects invalid plans and honours a pre-aborted signal without reading', async () => {
    const { scanner, read } = setup();
    for (const invalid of [
      { ...plan, accountId: 'a:b' },
      { ...plan, target: '' },
      { ...plan, files: [] },
      { ...plan, files: [plan.files[0], plan.files[0]] },
      { ...plan, files: [{ fileId: '0', source: 'script' }] },
      {
        ...plan,
        files: Array.from({ length: 501 }, (_, i) => ({ fileId: String(i + 1), source: 'script' })),
      },
    ])
      await expect(scanner.run(invalid as ImpactScanPlan)).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    expect(await scanner.run(plan, { signal: controller.signal })).toMatchObject({
      status: 'cancelled',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('preserves partial match-limit results instead of implying zero references', async () => {
    const { scanner, read } = setup();
    read.mockResolvedValueOnce({
      ...plan.files[0]!,
      accountId: plan.accountId,
      url: SO_URL,
      content: 'custbody_demo_flag '.repeat(1001),
    });
    const result = await scanner.run({ ...plan, files: [plan.files[0]!] });
    expect(result.results[0]).toMatchObject({ status: 'not-checked', reason: 'match-limit' });
    expect(result.results[0]!.hits).toHaveLength(1000);
    expect(result.results[0]!.hits.filter((hit) => hit.excerpt)).toHaveLength(20);
  });

  it('spaces requests and lets Cancel stop the rate-limit wait', async () => {
    const { scanner, read, readOriginal } = setup();
    const times: number[] = [];
    const original = readOriginal;
    read.mockImplementation(async (request) => {
      times.push(Date.now());
      return original(request);
    });
    await scanner.run(plan);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(240);
    const controller = new AbortController();
    const result = await scanner.run(plan, {
      refresh: true,
      signal: controller.signal,
      onProgress: (value) => {
        if (value.results.length === 1) setTimeout(() => controller.abort(), 10);
      },
    });
    expect(result).toMatchObject({ status: 'cancelled' });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('includes checkpoints in existing account/all cache deletion', async () => {
    const { scanner, cache, read } = setup();
    await scanner.run(plan);
    await cache.clearAccount(plan.accountId);
    await scanner.run(plan);
    await cache.clearAll();
    await scanner.run(plan);
    expect(read).toHaveBeenCalledTimes(6);
  });

  it('invalidates the old checkpoint when Refresh is cancelled before its first read', async () => {
    const { scanner, adapter, cache, read } = setup();
    await scanner.run(plan);
    const controller = new AbortController();
    const cancelled = await scanner.run(plan, {
      refresh: true,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    expect(cancelled).toMatchObject({ status: 'cancelled', results: [] });
    await createImpactScanner(adapter, cache).run(plan);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('detaches progress snapshots so consumers cannot alter checkpoints or the remaining plan', async () => {
    const { scanner, read } = setup();
    const result = await scanner.run(plan, {
      onProgress: (value) => {
        value.plan.files.length = 0;
        if (value.results[0]) value.results[0].hits.length = 0;
      },
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.plan.files).toHaveLength(2);
    expect(result.results[0]!.hits.length).toBeGreaterThan(0);
  });

  it('scans explicit saved searches with title, visibility, link and possible hits', async () => {
    const { scanner, adapter, cache } = setup();
    const searchPlan: ImpactScanPlan = { ...plan, files: [], searches: ['503', '999'] };
    const progress = await scanner.run(searchPlan);
    expect(progress.status).toBe('complete');
    expect(progress.searchResults[0]).toMatchObject({
      searchId: '503',
      status: 'checked',
      title: 'Demo flagged orders',
      isPublic: true,
      objectUrl: expect.stringContaining('search.nl?id=503'),
    });
    expect(progress.searchResults[0]!.hits).toHaveLength(2);
    expect(progress.searchResults[1]).toMatchObject({
      searchId: '999',
      status: 'not-checked',
      reason: 'UNSUPPORTED',
      hits: [],
    });
    // Restored from the checkpoint without rereading.
    const read = vi.spyOn(adapter, 'readImpactSavedSearch');
    const again = createImpactScanner(adapter, cache);
    expect((await again.run(searchPlan)).searchResults).toHaveLength(2);
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects duplicate saved searches', async () => {
    const { scanner } = setup();
    await expect(scanner.run({ ...plan, searches: ['503', '503'] })).rejects.toThrow();
  });
});
