import { browser } from 'wxt/browser';
import { McpControlSchema, type ContentRequest } from '../../netsuite/bridge/protocol';
import { NATIVE_HOST, type McpState } from '../../../packages/mcp-bridge/src/protocol';
import { createLiveAdapter } from '../../netsuite/adapter/LiveAdapter';
import { effectiveFeatures } from '../../shared/features';
import { getAccountSettings, getSettings, onStorageChange } from '../../shared/storage/settings';
import { createMcpSession } from './session';
import { MCP_STATE_KEY } from './state';

export function registerMcpBridge(
  sendToTab: (tabId: number, request: ContentRequest) => Promise<unknown>,
) {
  let connection: ReturnType<typeof browser.runtime.connectNative> | undefined;
  let session: ReturnType<typeof createMcpSession> | undefined;
  let tabId: number | undefined;
  let controls = Promise.resolve();
  let epoch = 0;
  const empty: McpState = { connected: false, sessions: [], log: [] };
  let latest: McpState = empty;
  const publish = async (state: McpState) => {
    latest = state;
    await browser.storage.session.set({ [MCP_STATE_KEY]: state });
  };
  // A new worker never restores approval, including after browser restart.
  void publish(empty);
  const disconnect = async () => {
    epoch++;
    const old = session;
    const port = connection;
    session = undefined;
    connection = undefined;
    tabId = undefined;
    port?.disconnect();
    if (old) await old.disconnect();
    await publish({ ...latest, connected: false, sessions: [] });
  };
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const parsed = McpControlSchema.safeParse(raw);
    if (
      !parsed.success ||
      sender.id !== browser.runtime.id ||
      !sender.url?.startsWith(browser.runtime.getURL('/'))
    )
      return false;
    controls = controls
      .catch(() => {})
      .then(async () => {
        try {
          const message = parsed.data;
          if (message.action === 'connect') {
            await disconnect();
            if (
              !effectiveFeatures(await getSettings()).mcpBridge ||
              !(await browser.permissions.contains({ permissions: ['nativeMessaging'] }))
            ) {
              sendResponse(false);
              return;
            }
            const connectEpoch = epoch;
            const pinnedTab = message.tabId;
            const adapter = createLiveAdapter({
              getTargetTab: async () => {
                try {
                  const tab = await browser.tabs.get(pinnedTab);
                  return { id: pinnedTab, url: tab.url };
                } catch {
                  return undefined;
                }
              },
              sendToTab,
            });
            const context = await adapter.getPageContext();
            if (!context) {
              await publish({ ...empty, error: 'NOT_NETSUITE' });
              sendResponse(false);
              return;
            }
            if (connectEpoch !== epoch || !effectiveFeatures(await getSettings()).mcpBridge) {
              sendResponse(false);
              return;
            }
            tabId = pinnedTab;
            const current = createMcpSession({
              adapter,
              context,
              enabled: async () => effectiveFeatures(await getSettings()).mcpBridge,
              allowProduction: async () =>
                (await getAccountSettings(context.accountId)).allowProductionMcp === true,
              publish: async (state) => {
                if (session === current) await publish(state);
              },
            });
            session = current;
            const port = browser.runtime.connectNative(NATIVE_HOST);
            connection = port;
            port.onMessage.addListener((request: unknown) => {
              void current
                .request(request)
                .then((response) => {
                  if (response && connection === port) port.postMessage(response);
                })
                .catch(() => {
                  /* Never log request data or adapter error text. */
                });
            });
            port.onDisconnect.addListener(() => {
              // Consume runtime.lastError; expose a fixed friendly status only.
              void browser.runtime.lastError;
              if (connection === port) {
                void disconnect().then(() => {
                  if (!connection && !session) return publish({ ...latest, error: 'DISCONNECTED' });
                });
              }
            });
            await publish(current.state);
            sendResponse(true);
          } else if (message.action === 'disconnect') {
            await disconnect();
            sendResponse(true);
          } else if (message.action === 'approve')
            sendResponse((await session?.approve(message.sessionId)) ?? false);
          else if (message.action === 'deny') {
            await session?.deny(message.sessionId);
            sendResponse(true);
          } else {
            if (session) await session.clearLog();
            else await publish({ ...latest, log: [] });
            sendResponse(true);
          }
        } catch {
          await disconnect();
          await publish({ ...latest, error: 'CONNECT_FAILED' });
          sendResponse(false);
        }
      });
    return true;
  });
  browser.tabs.onUpdated.addListener((id, info) => {
    if (id === tabId && (info.url || info.status === 'loading')) void disconnect();
  });
  browser.tabs.onRemoved.addListener((id) => {
    if (id === tabId) void disconnect();
  });
  browser.permissions.onRemoved.addListener((permissions) => {
    if (permissions.permissions?.includes('nativeMessaging')) void disconnect();
  });
  onStorageChange(() => {
    void getSettings().then(async (settings) => {
      if (
        (!effectiveFeatures(settings).mcpBridge ||
          (latest.environment === 'production' &&
            latest.accountId &&
            (await getAccountSettings(latest.accountId)).allowProductionMcp !== true)) &&
        (connection || session)
      )
        await disconnect();
    });
  });
}
