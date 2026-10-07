import { browser } from 'wxt/browser';
import { z } from 'zod';
import { isValidAccountId } from '../../netsuite/context/environment';
import { EnvironmentSchema, type Environment } from '../../netsuite/types';
import { AI_MODEL_ID_PATTERN, AI_PROVIDERS, DEFAULT_AI_MODEL } from '../../features/ai/types';
import { DEFAULT_FEATURES, FEATURE_IDS } from '../features';
import { WORKSPACE_ROLES } from '../workspace';

/**
 * Settings in chrome.storage.local (docs/architecture.md §5).
 *   settings              → global settings
 *   acct:<id>:settings    → per-account settings
 *   acct:<id>:goto        → Quick Go-to history (last 10)
 * Never store NetSuite credentials, cookies or tokens here.
 */

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

/** The pre-1.0 sandbox default (dark amber). Stored copies migrate to the lighter default. */
const LEGACY_SANDBOX_COLOR = '#d97706';

export const DEFAULT_ENV_COLORS: Record<Environment, string> = {
  production: '#dc2626',
  sandbox: '#f8c35a',
  release_preview: '#7c3aed',
  unknown: '#6b7280',
};

const FeaturesSchema = z.object(
  Object.fromEntries(FEATURE_IDS.map((id) => [id, z.boolean().catch(DEFAULT_FEATURES[id])])) as {
    [K in (typeof FEATURE_IDS)[number]]: z.ZodCatch<z.ZodBoolean>;
  },
);

/**
 * AI Assist settings (PRD-05 F-5.1, F-5.4, F-5.11, ADR 0041). The API key is never stored
 * here; it lives in the secure-storage module (`aiSecret.ts`).
 */
export const AiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS).catch('anthropic'),
  /**
   * Model ID for the selected provider. User-editable; switching provider in Settings resets it
   * to that provider's default.
   */
  model: z.string().trim().regex(AI_MODEL_ID_PATTERN).catch(DEFAULT_AI_MODEL),
  /** Output-token cap sent with every request. */
  maxTokensPerRequest: z.number().int().min(256).max(128_000).catch(4096),
  /** Local daily cap on input + output tokens; 0 = no limit. */
  maxTokensPerDay: z.number().int().min(0).max(100_000_000).catch(0),
  /** Default for the preview dialog's automatic redaction (F-5.11). */
  redact: z.boolean().catch(true),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export const DEFAULT_AI_SETTINGS: AiSettings = AiSettingsSchema.parse({});

export const SettingsSchema = z.object({
  onboardingComplete: z.boolean().catch(false),
  telemetryEnabled: z.boolean().catch(false),
  theme: z.enum(['system', 'light', 'dark']).catch('system'),
  /** Orders the panel tabs (src/shared/workspace.ts). */
  workspaceRole: z.enum(WORKSPACE_ROLES).catch('developer'),
  features: FeaturesSchema.catch(DEFAULT_FEATURES),
  /** Safe mode (PRD-06 F-6.1): every feature off, only Settings stays; `features` is kept. */
  safeMode: z.boolean().catch(false),
  showFieldIdsOnPage: z.boolean().catch(false),
  /** Record tab: hide fields without a value (remembered across records). */
  hideEmptyFields: z.boolean().catch(false),
  /** One-time panel tour shown (re-openable from the help menu). */
  tourComplete: z.boolean().catch(false),
  envColors: z
    .object({
      production: HexColor.catch(DEFAULT_ENV_COLORS.production),
      sandbox: HexColor.transform((color) =>
        color.toLowerCase() === LEGACY_SANDBOX_COLOR ? DEFAULT_ENV_COLORS.sandbox : color,
      ).catch(DEFAULT_ENV_COLORS.sandbox),
      release_preview: HexColor.catch(DEFAULT_ENV_COLORS.release_preview),
      unknown: HexColor.catch(DEFAULT_ENV_COLORS.unknown),
    })
    .catch(DEFAULT_ENV_COLORS),
  ai: AiSettingsSchema.catch(DEFAULT_AI_SETTINGS),
  /** Dev builds only (ignored in production builds). Undefined = build default. */
  adapterMode: z.enum(['live', 'fixture']).optional().catch(undefined),
});
export type Settings = z.infer<typeof SettingsSchema>;
export type Theme = Settings['theme'];

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const AccountSettingsSchema = z.object({
  cacheImpactIndex: z.boolean().optional().catch(undefined),
  label: z.string().max(60).optional().catch(undefined),
  allowProductionMcp: z.boolean().optional().catch(undefined),
  allowProductionWrites: z.boolean().optional().catch(undefined),
  environmentOverride: EnvironmentSchema.optional().catch(undefined),
  color: HexColor.optional().catch(undefined),
  /**
   * IANA time zone the account's log times are written in (set by the user). Unset = log times
   * are shown as NetSuite returns them, with no relative time.
   */
  logTimeZone: z.string().max(64).refine(isTimeZone).optional().catch(undefined),
});
export type AccountSettings = z.infer<typeof AccountSettingsSchema>;

export const SETTINGS_KEY = 'settings';
export const accountKey = (
  accountId: string,
  name: 'settings' | 'goto' | 'restlets' | 'tabs',
): string => {
  if (!isValidAccountId(accountId)) throw new Error('Invalid account ID');
  return `acct:${accountId}:${name}`;
};

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return SettingsSchema.parse(stored[SETTINGS_KEY] ?? {});
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = SettingsSchema.parse({ ...(await getSettings()), ...patch });
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getAccountSettings(accountId: string): Promise<AccountSettings> {
  const key = accountKey(accountId, 'settings');
  const stored = await browser.storage.local.get(key);
  return AccountSettingsSchema.parse(stored[key] ?? {});
}

export async function updateAccountSettings(
  accountId: string,
  patch: Partial<AccountSettings>,
): Promise<AccountSettings> {
  const merged: Record<string, unknown> = { ...(await getAccountSettings(accountId)), ...patch };
  for (const k of Object.keys(merged))
    if (merged[k] === undefined || merged[k] === '') delete merged[k];
  const next = AccountSettingsSchema.parse(merged);
  await browser.storage.local.set({ [accountKey(accountId, 'settings')]: next });
  return next;
}

/** Effective environment and banner color for an account. */
export function resolveEnvironment(
  detected: Environment,
  settings: Settings,
  account: AccountSettings,
): { environment: Environment; color: string } {
  const environment = account.environmentOverride ?? detected;
  return { environment, color: account.color ?? settings.envColors[environment] };
}

/** Subscribes to changes of any SuiteLens key in storage.local. Returns an unsubscribe function. */
export function onStorageChange(callback: (keys: string[]) => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local') callback(Object.keys(changes));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** "Delete all data": every storage.local key. IndexedDB is cleared by the cache module. */
export async function clearAllStorage(): Promise<void> {
  await browser.storage.local.clear();
}
