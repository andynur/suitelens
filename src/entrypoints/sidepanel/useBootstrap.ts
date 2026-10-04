import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { ContextChangedMessageSchema } from '../../netsuite/bridge/protocol';
import { createAdapter, effectiveAdapterMode } from '../../shared/adapter';
import { createLogger } from '../../shared/logger';
import { PENDING_VIEW_KEY } from '../../shared/sessionKeys';
import { getSettings, onStorageChange, SETTINGS_KEY } from '../../shared/storage/settings';
import { useAppStore } from '../../shared/store';

const log = createLogger('sidepanel');

/** Wires settings, adapter selection and browser events into the store. */
export function useBootstrap(): void {
  const adapterMode = useAppStore((s) => effectiveAdapterMode(s.settings));
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);

  // Settings (and live updates from other contexts).
  useEffect(() => {
    const load = () =>
      void getSettings()
        .then((s) => useAppStore.getState().setSettings(s))
        .catch((err: unknown) => log.warn('settings load failed', { err: String(err) }));
    load();
    return onStorageChange((keys) => {
      if (keys.includes(SETTINGS_KEY) || keys.length === 0) load();
    });
  }, []);

  // Adapter (re-created when the dev adapter mode changes).
  useEffect(() => {
    if (!settingsLoaded) return;
    let cancelled = false;
    void createAdapter(adapterMode).then((adapter) => {
      if (!cancelled) useAppStore.getState().setAdapter(adapter);
    });
    return () => {
      cancelled = true;
    };
  }, [adapterMode, settingsLoaded]);

  // Page context follows the active tab (F-1.3).
  useEffect(() => {
    const refresh = () => void useAppStore.getState().refreshContext();
    const onUpdated = (_tabId: number, info: { status?: string; url?: string }) => {
      if (info.status === 'complete' || info.url) refresh();
    };
    const onMessage = (message: unknown) => {
      if (ContextChangedMessageSchema.safeParse(message).success) refresh();
      return false;
    };
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.windows?.onFocusChanged.addListener(refresh);
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.windows?.onFocusChanged.removeListener(refresh);
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  // Pending view requested by a keyboard command (F-1.22).
  useEffect(() => {
    const consume = async () => {
      const stored = await browser.storage.session.get(PENDING_VIEW_KEY);
      if (stored[PENDING_VIEW_KEY] === 'goto') {
        useAppStore.getState().setGotoOpen(true);
        await browser.storage.session.remove(PENDING_VIEW_KEY);
      }
    };
    void consume();
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === 'session' && PENDING_VIEW_KEY in changes) void consume();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);
}

/** Applies the theme setting to <html> (system follows prefers-color-scheme). */
export function useTheme(): void {
  const theme = useAppStore((s) => s.settings.theme);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!media?.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media?.addEventListener('change', apply);
    return () => media?.removeEventListener('change', apply);
  }, [theme]);
}
