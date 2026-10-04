import { browser } from 'wxt/browser';
import type { ContentRequest, ForwardMessage } from '../netsuite/bridge/protocol';
import type { TargetTab } from '../netsuite/adapter/NetSuiteAdapter';
import { isNetSuiteUrl } from '../netsuite/context/environment';

/** Side panel → background → content script. The background validates and forwards. */
export async function sendToTabViaBackground(
  tabId: number,
  request: ContentRequest,
): Promise<unknown> {
  const message: ForwardMessage = { type: 'loupe:forward', tabId, request };
  return browser.runtime.sendMessage(message);
}

/**
 * The tab Loupe works against: the active tab of the side panel's window. When the side
 * panel page itself is open as a tab (development/E2E), falls back to the most recently
 * used NetSuite tab.
 */
export async function getTargetTab(): Promise<TargetTab | undefined> {
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  const ownPage = active?.url?.startsWith(browser.runtime.getURL('/'));
  if (active?.id !== undefined && !ownPage) return { id: active.id, url: active.url };

  const tabs = await browser.tabs.query({});
  const netsuite = tabs
    .filter((t) => t.id !== undefined && isNetSuiteUrl(t.url))
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
  return netsuite?.id !== undefined ? { id: netsuite.id, url: netsuite.url } : undefined;
}
