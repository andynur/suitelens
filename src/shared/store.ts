import type { Snippet } from './storage/consoleLibrary';
import { create } from 'zustand';
import type { NetSuiteAdapter } from '../netsuite/adapter/NetSuiteAdapter';
import { toSuiteLensError, type SuiteLensErrorShape } from '../netsuite/errors';
import type { PageContext } from '../netsuite/types';
import { effectiveFeatures } from './features';
import {
  DEFAULT_SETTINGS,
  SettingsSchema,
  updateSettings,
  type Settings,
} from './storage/settings';

/** Side panel UI state (Zustand). Persistent data lives in storage, not here. */

export type PanelTab =
  | 'home'
  | 'record'
  | 'inspector'
  | 'related'
  | 'automation'
  | 'console'
  | 'restlets'
  | 'logs'
  | 'impact'
  | 'docs'
  | 'ai'
  | 'settings';
export type ContextStatus = 'idle' | 'loading' | 'ready' | 'error';
export type Toast = { id: number; text: string };

type AppState = {
  settings: Settings;
  settingsLoaded: boolean;
  adapter?: NetSuiteAdapter;
  context: PageContext | null;
  contextStatus: ContextStatus;
  contextError?: SuiteLensErrorShape;
  activeTab: PanelTab;
  gotoOpen: boolean;
  /** AI Assist drawer, opened from the header over any tab. */
  aiOpen: boolean;
  setAiOpen(open: boolean): void;
  /** One-shot: the AI drawer opens with its setup section expanded; the drawer clears it. */
  aiSetupRequested?: boolean;
  /** Opens the AI drawer at its setup section (provider, key, limits). */
  openAiSetup(): void;
  /** One-shot field search handoff (command bar → Record tab). */
  fieldSearch?: { accountId: string; query: string };
  setFieldSearch(search: { accountId: string; query: string } | undefined): void;
  consoleDraft?: { accountId: string; sql: string; variables?: Snippet['variables'] };
  setConsoleDraft(
    draft: { accountId: string; sql: string; variables?: Snippet['variables'] } | undefined,
  ): void;
  /** One-shot handoff from Automation to Logs (script filter); Logs clears it on read. */
  logsFilter?: { accountId: string; script: string };
  setLogsFilter(filter: { accountId: string; script: string } | undefined): void;
  /** One-shot handoff from Logs to Automation (script card to show); Automation clears it. */
  automationFocus?: { accountId: string; scriptId: string };
  setAutomationFocus(focus: { accountId: string; scriptId: string } | undefined): void;
  /**
   * What the Record tab already read for the page (panel memory only), so the header and the
   * summary strip need no extra request. Keyed by account and page URL.
   */
  recordSummary?: { accountId: string; url: string; fieldCount: number; title?: string };
  setRecordSummary(summary: AppState['recordSummary']): void;
  /** Errors in the logs loaded by the Logs tab for this account (badge), panel memory only. */
  logErrors?: { accountId: string; count: number };
  setLogErrors(value: AppState['logErrors']): void;
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

/** Features that are on, after Safe mode (PRD-06 F-6.1). Use instead of `settings.features`. */
export const useFeatures = () => useAppStore((s) => effectiveFeatures(s.settings));

let toastId = 0;
let contextRequest = 0;

export const useAppStore = create<AppState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  context: null,
  contextStatus: 'idle',
  activeTab: 'record',
  gotoOpen: false,
  aiOpen: false,
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
      set({ context: null, contextStatus: 'error', contextError: toSuiteLensError(err).toShape() });
    }
  },

  setConsoleDraft: (consoleDraft) => set({ consoleDraft }),
  setLogsFilter: (logsFilter) => set({ logsFilter }),
  setAutomationFocus: (automationFocus) => set({ automationFocus }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  openAiSetup: () => set({ aiOpen: true, aiSetupRequested: true }),
  setRecordSummary: (recordSummary) => set({ recordSummary }),
  setLogErrors: (logErrors) => set({ logErrors }),
  setFieldSearch: (fieldSearch) => set({ fieldSearch }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setGotoOpen: (gotoOpen) => set({ gotoOpen }),

  toast(text) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text }] }));
    setTimeout(() => get().dismissToast(id), 2500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
