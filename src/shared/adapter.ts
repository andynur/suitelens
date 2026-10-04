import { createLiveAdapter } from '../netsuite/adapter/LiveAdapter';
import type { NetSuiteAdapter } from '../netsuite/adapter/NetSuiteAdapter';
import { getTargetTab, sendToTabViaBackground } from './messaging';
import type { Settings } from './storage/settings';

export type AdapterMode = 'live' | 'fixture';

/** True in dev and fixture (E2E) builds only; constant-folded in production builds. */
export const FIXTURES_AVAILABLE: boolean = __LOUPE_FIXTURES__;

export function effectiveAdapterMode(settings: Pick<Settings, 'adapterMode'>): AdapterMode {
  if (!FIXTURES_AVAILABLE) return 'live';
  return settings.adapterMode ?? __LOUPE_DEFAULT_ADAPTER__;
}

export async function createAdapter(mode: AdapterMode): Promise<NetSuiteAdapter> {
  if (FIXTURES_AVAILABLE && mode === 'fixture') {
    const [{ createFixtureAdapter, DEFAULT_FIXTURE_URL }, { loadFixtureSet }] = await Promise.all([
      import('../netsuite/adapter/FixtureAdapter'),
      import('../netsuite/adapter/fixtureSet'),
    ]);
    return createFixtureAdapter({
      fixtures: loadFixtureSet(),
      getTargetTab,
      fallbackUrl: DEFAULT_FIXTURE_URL,
      latencyMs: 150,
    });
  }
  return createLiveAdapter({ getTargetTab, sendToTab: sendToTabViaBackground });
}
