import { browser } from 'wxt/browser';
import { z } from 'zod';
import { isValidAccountId } from '../../netsuite/context/environment';
import { EnvironmentSchema, type Environment } from '../../netsuite/types';
import { DEFAULT_FEATURES, FEATURE_IDS } from '../features';

/**
 * Settings in chrome.storage.local (docs/architecture.md §5).
 *   settings              → global settings
 *   acct:<id>:settings    → per-account settings
 *   acct:<id>:goto        → Quick Go-to history (last 10)
 * Never store NetSuite credentials, cookies or tokens here.
 */

const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const DEFAULT_ENV_COLORS: Record<Environment, string> = {
  production: '#dc2626',
  sandbox: '#d97706',
  release_preview: '#7c3aed',
  unknown: '#6b7280',
};

const FeaturesSchema = z.object(
  Object.fromEntries(FEATURE_IDS.map((id) => [id, z.boolean().catch(DEFAULT_FEATURES[id])])) as {
    [K in (typeof FEATURE_IDS)[number]]: z.ZodCatch<z.ZodBoolean>;
  },
);

export const SettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).catch('system'),
  features: FeaturesSchema.catch(DEFAULT_FEATURES),
  showFieldIdsOnPage: z.boolean().catch(false),
  envColors: z
    .object({
      production: HexColor.catch(DEFAULT_ENV_COLORS.production),
      sandbox: HexColor.catch(DEFAULT_ENV_COLORS.sandbox),
      release_preview: HexColor.catch(DEFAULT_ENV_COLORS.release_preview),
      unknown: HexColor.catch(DEFAULT_ENV_COLORS.unknown),
    })
    .catch(DEFAULT_ENV_COLORS),
  /** Dev builds only (ignored in production builds). Undefined = build default. */
  adapterMode: z.enum(['live', 'fixture']).optional().catch(undefined),
});
export type Settings = z.infer<typeof SettingsSchema>;
export type Theme = Settings['theme'];

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

export const AccountSettingsSchema = z.object({
  label: z.string().max(60).optional().catch(undefined),
  environmentOverride: EnvironmentSchema.optional().catch(undefined),
  color: HexColor.optional().catch(undefined),
});
export type AccountSettings = z.infer<typeof AccountSettingsSchema>;

export const SETTINGS_KEY = 'settings';
export const accountKey = (accountId: string, name: 'settings' | 'goto'): string => {
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

/** Subscribes to changes of any Loupe key in storage.local. Returns an unsubscribe function. */
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
