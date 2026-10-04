import { create } from 'zustand';
import type { NetSuiteAdapter } from '../netsuite/adapter/NetSuiteAdapter';
import { toLoupeError, type LoupeErrorShape } from '../netsuite/errors';
import type { PageContext } from '../netsuite/types';
import {
  DEFAULT_SETTINGS,
  SettingsSchema,
  updateSettings,
  type Settings,
} from './storage/settings';

/** Side panel UI state (Zustand). Persistent data lives in storage, not here. */

export type PanelTab = 'record' | 'automation' | 'settings';
export type ContextStatus = 'idle' | 'loading' | 'ready' | 'error';
export type Toast = { id: number; text: string };

type AppState = {
  settings: Settings;
  settingsLoaded: boolean;
  adapter?: NetSuiteAdapter;
  context: PageContext | null;
  contextStatus: ContextStatus;
  contextError?: LoupeErrorShape;
  activeTab: PanelTab;
  gotoOpen: boolean;
  toasts: Toast[];

  setSettings(settings: Settings): void;
  /** Optimistic settings update: UI first, then storage (other contexts follow via onChanged). */
  saveSettings(patch: Partial<Settings>): Promise<void>;
  setAdapter(adapter: NetSuiteAdapter): void;
  refreshContext(): Promise<void>;
  setActiveTab(tab: PanelTab): void;
  setGotoOpen(open: boolean): void;
  toast(text: string): void;
  dismissToast(id: number): void;
};

let toastId = 0;
let contextRequest = 0;

export const useAppStore = create<AppState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  context: null,
  contextStatus: 'idle',
  activeTab: 'record',
  gotoOpen: false,
  toasts: [],

  setSettings: (settings) => set({ settings, settingsLoaded: true }),
  async saveSettings(patch) {
    set((s) => ({ settings: SettingsSchema.parse({ ...s.settings, ...patch }) }));
    await updateSettings(patch);
  },
  setAdapter: (adapter) => {
    set({ adapter });
    void get().refreshContext();
  },

  async refreshContext() {
    const adapter = get().adapter;
    if (!adapter) return;
    const request = ++contextRequest;
    set((s) => ({ contextStatus: s.context ? s.contextStatus : 'loading' }));
    try {
      const context = await adapter.getPageContext();
      // Ignore stale answers when the user switched tabs meanwhile.
      if (request !== contextRequest) return;
      set({ context, contextStatus: 'ready', contextError: undefined });
    } catch (err) {
      if (request !== contextRequest) return;
      set({ context: null, contextStatus: 'error', contextError: toLoupeError(err).toShape() });
    }
  },

  setActiveTab: (activeTab) => set({ activeTab }),
  setGotoOpen: (gotoOpen) => set({ gotoOpen }),

  toast(text) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text }] }));
    setTimeout(() => get().dismissToast(id), 2500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
