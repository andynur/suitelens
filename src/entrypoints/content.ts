import '../netsuite/zodSetup';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import { applyEnvironmentGuard } from '../features/environment-guard/guard';
import { watchFieldIdBadges } from '../features/field-ids-overlay/overlay';
import { createContentService, fetchSameOriginText } from '../netsuite/adapter/contentService';
import { createNonce } from '../netsuite/bridge/nonce';
import { ContentMessageSchema, type ContextChangedMessage } from '../netsuite/bridge/protocol';
import { createBridgeClient, type BridgeClient } from '../netsuite/bridge/transport';
import { detectFromUrl } from '../netsuite/context/detect';
import { LoupeError } from '../netsuite/errors';
import { createLogger } from '../shared/logger';
import {
  getAccountSettings,
  getSettings,
  onStorageChange,
  resolveEnvironment,
  SETTINGS_KEY,
} from '../shared/storage/settings';

const log = createLogger('content');

/**
 * Content script (ISOLATED world) on NetSuite pages: context detection, Environment Guard,
 * field ID badges, and the page side of LiveAdapter. Kept light (NF-1.2): the bridge is
 * injected lazily on the first request that needs it.
 */
export default defineContentScript({
  matches: ['https://*.app.netsuite.com/*'],
  runAt: 'document_idle',
  allFrames: false,

  main(ctx) {
    // Guard against double execution when the background re-injects this script.
    const flag = '__netsuiteLoupeContent';
    const marker = document.documentElement;
    if (marker.dataset[flag]) return;
    marker.dataset[flag] = '1';

    let bridgePromise: Promise<BridgeClient> | undefined;
    const getBridge = () => {
      bridgePromise ??= connectBridge().catch((err: unknown) => {
        bridgePromise = undefined;
        throw err;
      });
      return bridgePromise;
    };

    const service = createContentService({
      getUrl: () => location.href,
      doc: document,
      getBridge,
      fetchText: (url) => fetchSameOriginText(url, location.origin),
    });

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id) return false;
      const parsed = ContentMessageSchema.safeParse(message);
      if (!parsed.success) return false;
      void service.handle(parsed.data.request).then(sendResponse);
      return true;
    });

    // --- Page features driven by settings -----------------------------------------
    const initial = detectFromUrl(location.href);
    if (!initial) return;
    const accountId = initial.accountId;
    let stopBadges: (() => void) | undefined;

    const applySettings = async () => {
      const [settings, account] = await Promise.all([getSettings(), getAccountSettings(accountId)]);
      const { environment, color } = resolveEnvironment(initial.environment, settings, account);
      applyEnvironmentGuard(document, {
        enabled: settings.features.environmentGuard,
        accountId,
        environment,
        color,
        label: account.label,
      });
      const showIds = settings.features.fieldIdsOverlay && settings.showFieldIdsOnPage;
      if (showIds && !stopBadges) stopBadges = watchFieldIdBadges(document);
      if (!showIds && stopBadges) {
        stopBadges();
        stopBadges = undefined;
      }
    };

    void applySettings().catch((err: unknown) =>
      log.warn('apply settings failed', { err: String(err) }),
    );
    const unsubscribe = onStorageChange((keys) => {
      if (keys.some((k) => k === SETTINGS_KEY || k === `acct:${accountId}:settings`)) {
        void applySettings();
      }
    });
    ctx.onInvalidated(() => {
      unsubscribe();
      stopBadges?.();
    });

    // --- Context publishing (F-1.3) ------------------------------------------------
    const publish = async () => {
      try {
        const context = await service.getPageContext();
        const message: ContextChangedMessage = { type: 'loupe:context-changed', context };
        await browser.runtime.sendMessage(message);
      } catch {
        // No side panel open: nothing to notify.
      }
    };
    void publish();
    let lastUrl = location.href;
    const onNavigate = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      void publish();
    };
    ctx.addEventListener(window, 'popstate', onNavigate);
    ctx.addEventListener(window, 'hashchange', onNavigate);
    ctx.addEventListener(window, 'focus', () => void publish());
  },
});

async function connectBridge(): Promise<BridgeClient> {
  const nonce = createNonce();
  try {
    await injectScript('/bridge.js', {
      modifyScript: (script) => {
        script.dataset.loupeNonce = nonce;
      },
    });
  } catch (err) {
    throw new LoupeError('BRIDGE_UNAVAILABLE', 'Could not load the page bridge.', String(err));
  }
  const client = createBridgeClient(window, nonce);
  try {
    await client.call({ op: 'ping' }, 5000);
  } catch (err) {
    client.dispose();
    throw new LoupeError('BRIDGE_UNAVAILABLE', 'The page bridge did not answer.', String(err));
  }
  return client;
}
