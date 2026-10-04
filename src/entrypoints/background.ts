import '../netsuite/zodSetup';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  ContentResponseSchemas,
  ForwardMessageSchema,
  type ContentMessage,
  type ContentRequest,
  type Result,
} from '../netsuite/bridge/protocol';
import { isNetSuiteUrl } from '../netsuite/context/environment';
import { SuiteLensError, toSuiteLensError } from '../netsuite/errors';
import { createLogger } from '../shared/logger';
import { PENDING_VIEW_KEY } from '../shared/sessionKeys';

const log = createLogger('background');
const CONTENT_SCRIPT_FILE = '/content-scripts/content.js';

/**
 * Background service worker: message router between the side panel and content scripts.
 * Keeps no important state in memory (MV3 may stop it at any time).
 */
export default defineBackground(() => {
  // Chrome: clicking the toolbar icon opens the side panel. Guarded for other browsers.
  browser.sidePanel
    ?.setPanelBehavior?.({ openPanelOnActionClick: true })
    .catch((err: unknown) => log.warn('setPanelBehavior failed', { err: String(err) }));

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const parsed = ForwardMessageSchema.safeParse(message);
    if (!parsed.success) return false;
    // Only extension pages (side panel) may ask for forwarding; never content scripts.
    if (sender.id !== browser.runtime.id || !sender.url?.startsWith(browser.runtime.getURL('/'))) {
      return false;
    }
    void forward(parsed.data.tabId, parsed.data.request).then(sendResponse);
    return true; // async response
  });

  browser.commands?.onCommand.addListener((command, tab) => {
    if (command !== 'open-goto' || tab?.id === undefined) return;
    // open() must run synchronously inside the user gesture.
    browser.sidePanel?.open?.({ tabId: tab.id }).catch((err: unknown) => {
      log.warn('sidePanel.open failed', { err: String(err) });
    });
    void browser.storage.session.set({ [PENDING_VIEW_KEY]: 'goto' });
  });
});

async function forward(tabId: number, request: ContentRequest): Promise<Result<unknown>> {
  try {
    const tab = await browser.tabs.get(tabId);
    if (!isNetSuiteUrl(tab.url)) {
      throw new SuiteLensError('NOT_NETSUITE', 'The active tab is not a NetSuite page.');
    }
    const raw = await sendWithInjection(tabId, { type: 'suitelens:content', request });
    const parsed = ContentResponseSchemas[request.op].safeParse(raw);
    if (!parsed.success) {
      throw new SuiteLensError('INVALID_RESPONSE', 'Unexpected response from the NetSuite page.');
    }
    return parsed.data;
  } catch (err) {
    const error = toSuiteLensError(err);
    log.debug('forward failed', { op: request.op, code: error.code });
    return { ok: false, error: error.toShape() };
  }
}

/**
 * Sends to the content script; if none is listening (tab opened before install/update),
 * injects it once through `scripting` and retries.
 */
async function sendWithInjection(tabId: number, message: ContentMessage): Promise<unknown> {
  try {
    return await browser.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (!isNoReceiver(err)) throw err;
  }
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT_FILE] });
    return await browser.tabs.sendMessage(tabId, message);
  } catch (err) {
    throw new SuiteLensError(
      'NO_CONTENT_SCRIPT',
      'SuiteLens cannot reach this tab. Reload the NetSuite page.',
      String(err),
    );
  }
}

function isNoReceiver(err: unknown): boolean {
  return /receiving end does not exist|could not establish connection/i.test(String(err));
}
