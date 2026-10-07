import { describe, expect, it, vi } from 'vitest';
import { readFixture, SO_URL } from '../../test/fixtures';
import { fixtureAdapter } from '../../test/adapters';
import { createContentService } from '../adapter/contentService';
import { createLiveAdapter } from '../adapter/LiveAdapter';
import { ContentRequestSchema, ContentResponseSchemas } from '../bridge/protocol';
import { pdfEditorId, readPdfEditor, validatePdfEditorSource } from './pdfEditor';
import { SOURCE_LIMITS } from './source';

export const EDITOR_URL = new URL(
  '/app/common/custom/advancedprint/pdftemplate.nl?id=3&nl=T&tt=PurchOrd&pt=TRANSACTION&source=F&savedsearchid=-1&rt=&e=T',
  SO_URL,
).href;
const req = { accountId: '1234567-sb1', editorId: '3' };
const doc = () =>
  new DOMParser().parseFromString(readFixture('impact-analysis/pdf-editor.html'), 'text/html');

describe('active Advanced PDF editor source', () => {
  it('keeps editor identity separate from template and file IDs at the message boundary', () => {
    expect(
      ContentRequestSchema.safeParse({ op: 'readImpactPdfEditor', request: req }).success,
    ).toBe(true);
    for (const editorId of ['-1', '3&delete=T', '1'.repeat(21)])
      expect(
        ContentRequestSchema.safeParse({ op: 'readImpactPdfEditor', request: { ...req, editorId } })
          .success,
      ).toBe(false);
    expect(
      ContentRequestSchema.safeParse({
        op: 'readImpactPdfEditor',
        request: { ...req, fileId: '3' },
      }).success,
    ).toBe(false);
  });
  it.each([
    SO_URL,
    EDITOR_URL + '&id=4',
    EDITOR_URL + '&delete=T',
    EDITOR_URL + '#source',
    EDITOR_URL.replace('https://', 'https://user:pass@'),
    EDITOR_URL.replace('https://', 'http://'),
  ])('rejects unsupported editor URL %s', (url) => {
    expect(pdfEditorId(url)).toBeUndefined();
  });
  it('reads XML textarea value and labels standard Customize as unsaved without a persisted ID', () => {
    const source = readPdfEditor(doc(), EDITOR_URL, req);
    expect(source).toMatchObject({ ...req, state: 'unsaved', url: EDITOR_URL });
    expect(source.templateId).toBeUndefined();
    expect(source.content).toContain('<p>${record.custbody_demo_flag}</p>');
    expect(
      ContentResponseSchemas.readImpactPdfEditor.safeParse({ ok: true, data: source }).success,
    ).toBe(true);
  });
  it('requires matching positive hidden and URL identities for an existing editor', () => {
    const page = doc();
    page.querySelector<HTMLInputElement>('#pdftemplate-id')!.value = '3';
    const saved = EDITOR_URL.replace('nl=T', 'nl=F').replace('source=F', 'source=T');
    expect(readPdfEditor(page, saved, req)).toMatchObject({ state: 'existing', templateId: '3' });
    expect(() => readPdfEditor(page, EDITOR_URL, req)).toThrow('Source Code');
    page.querySelector<HTMLInputElement>('#pdftemplate-id')!.value = '4';
    expect(() => readPdfEditor(page, saved, req)).toThrow('Source Code');
  });
  it('supports URL context zero only for an unsaved custom-record editor', () => {
    expect(
      readPdfEditor(doc(), EDITOR_URL.replace('id=3', 'id=0'), { ...req, editorId: '0' }),
    ).toMatchObject({ state: 'unsaved', editorId: '0' });
  });
  it.each([
    'missing-source',
    'duplicate-source',
    'wrong-name',
    'missing-id',
    'duplicate-id',
    'unknown-id',
    'wysiwyg',
    'missing-mode',
    'duplicate-mode',
    'html',
    'empty',
    'binary',
    'too-large',
    'too-many-bytes',
  ])('fails closed for %s', (kind) => {
    const page = doc();
    const area = page.querySelector<HTMLTextAreaElement>('#source-template')!;
    const id = page.querySelector<HTMLInputElement>('#pdftemplate-id')!;
    const mode = page.querySelector<HTMLInputElement>('#pdftemplate-not-show-source')!;
    if (kind === 'missing-source') area.remove();
    if (kind === 'duplicate-source') page.body.append(area.cloneNode(true));
    if (kind === 'wrong-name') area.name = 'wysiwyg-template';
    if (kind === 'missing-id') id.remove();
    if (kind === 'duplicate-id') page.body.append(id.cloneNode(true));
    if (kind === 'unknown-id') id.value = '0';
    if (kind === 'wysiwyg') mode.value = 'T';
    if (kind === 'missing-mode') mode.remove();
    if (kind === 'duplicate-mode') page.body.append(mode.cloneNode(true));
    if (kind === 'html') area.value = '<html>Login</html>';
    if (kind === 'empty') area.value = '';
    if (kind === 'binary') area.value = '%PDF-1.0';
    if (kind === 'too-large') area.value = 'a'.repeat(SOURCE_LIMITS.characters + 1);
    if (kind === 'too-many-bytes') area.value = '<pdf>' + '界'.repeat(700_000) + '</pdf>';
    expect(() => readPdfEditor(page, EDITOR_URL, req)).toThrow();
  });
  it('checks account and URL identity before reading', () => {
    expect(() => readPdfEditor(doc(), EDITOR_URL, { ...req, accountId: '9999' })).toThrow(
      'Account changed',
    );
    expect(() => readPdfEditor(doc(), EDITOR_URL, { ...req, editorId: '4' })).toThrow(
      'Source Code',
    );
  });
  it('reads through content service without network calls or the MAIN bridge and rejects navigation', async () => {
    let url = EDITOR_URL;
    const fetchText = vi.fn();
    const sourceFetch = vi.fn();
    const getBridge = vi.fn();
    const service = createContentService({
      getUrl: () => url,
      doc: doc(),
      fetchText,
      sourceFetch,
      getBridge,
    });
    expect(await service.handle({ op: 'readImpactPdfEditor', request: req })).toMatchObject({
      ok: true,
      data: { state: 'unsaved' },
    });
    expect(fetchText).not.toHaveBeenCalled();
    expect(sourceFetch).not.toHaveBeenCalled();
    expect(getBridge).not.toHaveBeenCalled();
    const area = doc();
    Object.defineProperty(area.querySelector('#source-template')!, 'value', {
      get: () => {
        url = SO_URL;
        return '<pdf></pdf>';
      },
    });
    url = EDITOR_URL;
    const changed = createContentService({ getUrl: () => url, doc: area, fetchText, getBridge });
    expect(await changed.handle({ op: 'readImpactPdfEditor', request: req })).toMatchObject({
      ok: false,
      error: { code: 'ACCOUNT_MISMATCH' },
    });
  });
  it('validates returned account, editor identity and exact URL in the live adapter', async () => {
    const source = readPdfEditor(doc(), EDITOR_URL, req);
    const sendToTab = vi.fn(async () => ({ ok: true, data: source }));
    const adapter = createLiveAdapter({
      getTargetTab: async () => ({ id: 1, url: EDITOR_URL }),
      sendToTab,
    });
    expect(await adapter.readImpactPdfEditor(req)).toEqual(source);
    expect(sendToTab).toHaveBeenCalledWith(1, { op: 'readImpactPdfEditor', request: req });
    for (const bad of [
      { ...source, accountId: '9999' },
      { ...source, editorId: '4' },
      { ...source, url: EDITOR_URL + '&sc=-90' },
    ]) {
      sendToTab.mockResolvedValueOnce({ ok: true, data: bad });
      await expect(adapter.readImpactPdfEditor(req)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    }
    expect(() =>
      validatePdfEditorSource({ ...source, state: 'existing', templateId: '4' }, EDITOR_URL, req),
    ).toThrow();
  });
  it('discards live responses on tab changes and refuses the wrong account before transport', async () => {
    const source = readPdfEditor(doc(), EDITOR_URL, req);
    let tabId = 1;
    const sendToTab = vi.fn(async () => {
      tabId = 2;
      return { ok: true, data: source };
    });
    const adapter = createLiveAdapter({
      getTargetTab: async () => ({ id: tabId, url: EDITOR_URL }),
      sendToTab,
    });
    await expect(adapter.readImpactPdfEditor(req)).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    sendToTab.mockClear();
    await expect(adapter.readImpactPdfEditor({ ...req, accountId: '9999' })).rejects.toMatchObject({
      code: 'ACCOUNT_MISMATCH',
    });
    expect(sendToTab).not.toHaveBeenCalled();
  });
  it('fixture adapter applies the same editor guards', async () => {
    expect(await fixtureAdapter(EDITOR_URL).readImpactPdfEditor(req)).toMatchObject({
      state: 'unsaved',
    });
    await expect(fixtureAdapter().readImpactPdfEditor(req)).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
    await expect(
      fixtureAdapter(EDITOR_URL).readImpactPdfEditor({ ...req, accountId: '9999' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
  });
});
