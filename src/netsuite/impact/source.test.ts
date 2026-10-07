import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFixture, SO_URL } from '../../test/fixtures';
import { createContentService } from '../adapter/contentService';
import { createLiveAdapter } from '../adapter/LiveAdapter';
import { createFixtureAdapter } from '../adapter/FixtureAdapter';
import { ContentRequestSchema } from '../bridge/protocol';
import { SuiteLensError } from '../errors';
import {
  fetchImpactSource,
  sourceDisplayLink,
  fileCabinetPageUrls,
  findSourceLink,
  findSourceLinkInHtml,
  SOURCE_LIMITS,
  validateSourceContent,
} from './source';
import type { ImpactSource } from './source';

const request = { accountId: '1234567-sb1', fileId: '501', source: 'script' } as const;
const script = readFixture('impact-analysis/user-event.js');
const pdf = readFixture('impact-analysis/invoice-template.xml');
const page = () =>
  new DOMParser().parseFromString(readFixture('impact-analysis/file-cabinet.html'), 'text/html');
const url = new URL('/core/media/media.nl?id=501&c=1234567_SB1&h=fake-script', SO_URL).href;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function service(fetcher = vi.fn(async () => script)) {
  let currentUrl = SO_URL;
  const svc = createContentService({
    getUrl: () => currentUrl,
    doc: page(),
    sourceFetch: fetcher,
    fetchText: vi.fn(),
    getBridge: vi.fn(),
  });
  return {
    svc,
    fetcher,
    changeUrl: (value: string) => {
      currentUrl = value;
    },
  };
}

describe('linked impact sources', () => {
  it('requires bounded IDs at the message boundary', () => {
    for (const fileId of ['0', '-1', '1&delete=T', '1'.repeat(21)])
      expect(
        ContentRequestSchema.safeParse({ op: 'readImpactSource', request: { ...request, fileId } })
          .success,
      ).toBe(false);
  });
  it('returns only an observed link for the requested account and file', () => {
    expect(findSourceLink(page(), SO_URL, request)).toBe(url);
    expect(() => findSourceLink(page(), SO_URL, { ...request, fileId: '503' })).toThrow(
      'download link',
    );
    expect(() => findSourceLink(page(), SO_URL, { ...request, accountId: 'other' })).toThrow(
      'Account changed',
    );
  });
  it.each([
    'https://evil.example/core/media/media.nl?id=501',
    '/app/common/media/mediaitem.nl?id=501&delete=T',
    '/core/media/media.nl?id=501&c=9999',
    '/core/media/media.nl?id=501&id=502',
    '/core/media/media.nl?id=501&c=1234567_SB1&c=9999',
    '/core/media/media.nl?id=501&delete=T',
    'https://user:pass@1234567-sb1.app.netsuite.com/core/media/media.nl?id=501',
  ])('rejects unsafe page link %s', (href) => {
    const doc = page();
    doc.body.replaceChildren();
    const a = doc.createElement('a');
    a.setAttribute('href', href);
    doc.body.append(a);
    expect(() => findSourceLink(doc, SO_URL, request)).toThrow('download link');
  });
  it('reads fake script and XML template through content service without the MAIN bridge', async () => {
    const { svc, fetcher } = service();
    expect(await svc.handle({ op: 'readImpactSource', request })).toEqual({
      ok: true,
      data: { ...request, url, content: script },
    });
    fetcher.mockResolvedValueOnce(pdf);
    expect(
      await svc.handle({
        op: 'readImpactSource',
        request: { ...request, fileId: '502', source: 'pdf-template' },
      }),
    ).toMatchObject({ ok: true, data: { content: pdf } });
  });
  it('keeps permission failures explicit and rejects navigation during acquisition', async () => {
    const denied = service(
      vi.fn(async () => {
        throw new SuiteLensError('PERMISSION_DENIED', 'Denied');
      }),
    );
    expect(await denied.svc.handle({ op: 'readImpactSource', request })).toMatchObject({
      ok: false,
      error: { code: 'PERMISSION_DENIED' },
    });
    const fetcher = vi.fn(async () => {
      target.changeUrl(SO_URL + '&changed=T');
      return script;
    });
    const target = service(fetcher);
    expect(await target.svc.handle({ op: 'readImpactSource', request })).toMatchObject({
      ok: false,
      error: { code: 'ACCOUNT_MISMATCH' },
    });
  });
  it('blocks mismatched accounts before network access', async () => {
    const { svc, fetcher } = service();
    expect(
      await svc.handle({ op: 'readImpactSource', request: { ...request, accountId: 'other' } }),
    ).toMatchObject({ ok: false, error: { code: 'ACCOUNT_MISMATCH' } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    '',
    '<!doctype html><html>Login</html>',
    '<html>Denied</html>',
    '<!-- prolog --><html>Login</html>',
    '%PDF-1.4',
    'binary\0',
    'x'.repeat(SOURCE_LIMITS.characters + 1),
  ])('rejects unreadable source (%#)', (text) => {
    expect(() => validateSourceContent(text, 'script')).toThrow();
  });
  it('requires XML PDF template text, not rendered output', () => {
    expect(validateSourceContent(pdf, 'pdf-template')).toBe(pdf);
    expect(() => validateSourceContent(script, 'pdf-template')).toThrow('XML PDF template');
  });
  it('validates live responses and target ownership', async () => {
    let target = { id: 3, url: SO_URL };
    const sendToTab = vi.fn(async (): Promise<{ ok: boolean; data: ImpactSource }> => ({
      ok: true,
      data: { ...request, url, content: script },
    }));
    const adapter = createLiveAdapter({ getTargetTab: async () => target, sendToTab });
    expect(await adapter.readImpactSource(request)).toMatchObject({ content: script });
    sendToTab.mockResolvedValueOnce({
      ok: true,
      data: { ...request, fileId: '999', url, content: script },
    });
    await expect(adapter.readImpactSource(request)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    sendToTab.mockImplementationOnce(async () => {
      target = { id: 4, url: SO_URL };
      return { ok: true, data: { ...request, url, content: script } };
    });
    await expect(adapter.readImpactSource(request)).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    await expect(
      adapter.readImpactSource({ ...request, accountId: 'other' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
  });
  it('fixture adapter uses exact file fixtures, never falls back to another file', async () => {
    const adapter = createFixtureAdapter({
      getTargetTab: async () => ({ id: 1, url: SO_URL }),
      fixtures: {
        records: {},
        currentRecords: {},
        suiteql: {},
        customRecordTypes: {},
        impactSources: { '501': { source: 'script', content: script, link: url } },
      },
    });
    expect(await adapter.readImpactSource(request)).toMatchObject({ content: script });
    await expect(adapter.readImpactSource({ ...request, fileId: '502' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
    await expect(
      adapter.readImpactSource({ ...request, accountId: 'other' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
  });
});

describe('bounded source transport', () => {
  it('uses session GET with no redirects and returns text', async () => {
    const fetcher = vi.fn(async () => new Response(script));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchImpactSource(url, new URL(SO_URL).origin)).toBe(script);
    expect(fetcher).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        credentials: 'same-origin',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
    await expect(
      fetchImpactSource('https://evil.example/source', new URL(SO_URL).origin),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404])('preserves HTTP %s failure', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status })),
    );
    await expect(fetchImpactSource(url, new URL(SO_URL).origin)).rejects.toMatchObject({
      code: status === 404 ? 'INVALID_RESPONSE' : 'PERMISSION_DENIED',
    });
  });
  it('bounds declared size and streamed size without a content-length header', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('x', { headers: { 'content-length': String(SOURCE_LIMITS.bytes + 1) } }),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchImpactSource(url, new URL(SO_URL).origin)).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
    fetcher.mockResolvedValueOnce(new Response('x'.repeat(SOURCE_LIMITS.bytes + 1)));
    await expect(fetchImpactSource(url, new URL(SO_URL).origin)).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });
  it('times out and reports a failed read, rather than an empty source', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    const reading = expect(fetchImpactSource(url, new URL(SO_URL).origin)).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(SOURCE_LIMITS.timeoutMs);
    await reading;
  });
});

describe('File Cabinet page links', () => {
  const html =
    '<a href="/core/media/media.nl?id=503&amp;c=1234567_SB1&amp;h=fake-503&amp;_xt=.js">x</a>' +
    '<a href="/core/media/media.nl?id=504&amp;h=fake-504&amp;delete=T">bad</a>' +
    '<a href="https://evil.example/core/media/media.nl?id=505&amp;h=x">far</a>';
  it('accepts only a valid same-origin link for the requested file', () => {
    expect(findSourceLinkInHtml(html, SO_URL, { ...request, fileId: '503' })).toBe(
      new URL('/core/media/media.nl?id=503&c=1234567_SB1&h=fake-503&_xt=.js', SO_URL).href,
    );
    for (const fileId of ['504', '505', '506'])
      expect(findSourceLinkInHtml(html, SO_URL, { ...request, fileId })).toBeUndefined();
    expect(() => findSourceLinkInHtml(html, SO_URL, { ...request, accountId: 'other' })).toThrow(
      'Account changed',
    );
  });
  it('builds only fixed same-origin page URLs', () => {
    expect(fileCabinetPageUrls(SO_URL, { ...request, folderId: '-15' })).toEqual([
      'https://1234567-sb1.app.netsuite.com/app/common/media/mediaitemfolders.nl?folder=-15',
      'https://1234567-sb1.app.netsuite.com/app/common/media/mediaitem.nl?id=501',
    ]);
  });
  it('resolves a missing on-page link from the File Cabinet and caches folder pages', async () => {
    const fetchText = vi.fn(async () => html);
    const sourceFetch = vi.fn(async () => script);
    const svc = createContentService({
      getUrl: () => SO_URL,
      doc: page(),
      sourceFetch,
      fetchText,
      getBridge: vi.fn(),
      now: () => 1,
    });
    const read = (fileId: string) =>
      svc.handle({
        op: 'readImpactSource',
        request: { ...request, fileId, folderId: '668' },
      });
    expect(await read('503')).toMatchObject({ ok: true });
    expect(await read('503')).toMatchObject({ ok: true });
    expect(fetchText).toHaveBeenCalledTimes(1);
    expect((fetchText.mock.calls as unknown as string[][])[0]![0]).toContain(
      'mediaitemfolders.nl?folder=668',
    );
    expect(await read('506')).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED' },
    });
  });
});

it('only exposes matching same-account observed source URLs for display', () => {
  const valid = 'https://1234567-sb1.app.netsuite.com/core/media/media.nl?id=501&h=fake';
  expect(sourceDisplayLink(valid, SO_URL, request)).toBe(valid);
  for (const url of [
    valid.replace('id=501', 'id=502'),
    valid.replace('1234567-sb1.app.netsuite.com', 'evil.example'),
    valid.replace('https:', 'http:'),
    valid + '&id=501',
    valid + '&redirect=evil',
    // eslint-disable-next-line no-script-url -- Adversarial URL is rejected, never executed.
    'javascript:alert(1)',
    SO_URL,
  ]) {
    expect(sourceDisplayLink(url, SO_URL, request)).toBeUndefined();
  }
  expect(sourceDisplayLink(valid, SO_URL, { ...request, accountId: 'other' })).toBeUndefined();
});
