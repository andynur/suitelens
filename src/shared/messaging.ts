import { browser } from 'wxt/browser';
import type { ContentRequest, ForwardMessage } from '../netsuite/bridge/protocol';
import type { TargetTab } from '../netsuite/adapter/NetSuiteAdapter';
import { isNetSuiteUrl } from '../netsuite/context/environment';

/** Side panel → background → content script. The background validates and forwards. */
export async function sendToTabViaBackground(
  tabId: number,
  request: ContentRequest,
): Promise<unknown> {
  const message: ForwardMessage = { type: 'suitelens:forward', tabId, request };
  return browser.runtime.sendMessage(message);
}

/**
 * The tab SuiteLens works against: the active tab of the side panel's window. When the side
 * panel page itself is open as a tab (development/E2E), falls back to the most recently
 * used NetSuite tab. (`tabs.getCurrent()` is only defined for pages shown in a tab.)
 */
export async function getTargetTab(): Promise<TargetTab | undefined> {
  const pinned = new URL(location.href).searchParams.get('targetTab');
  if (pinned && /^\d+$/.test(pinned)) {
    try {
      const tab = await browser.tabs.get(Number(pinned));
      return tab.id !== undefined && isNetSuiteUrl(tab.url)
        ? { id: tab.id, url: tab.url }
        : undefined;
    } catch {
      return undefined;
    }
  }
  const ownTab = await browser.tabs.getCurrent();
  if (!ownTab) {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    return active?.id !== undefined ? { id: active.id, url: active.url } : undefined;
  }
  const tabs = await browser.tabs.query({});
  const netsuite = tabs
    .filter((t) => t.id !== undefined && t.id !== ownTab.id && isNetSuiteUrl(t.url))
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
  return netsuite?.id !== undefined ? { id: netsuite.id, url: netsuite.url } : undefined;
}
