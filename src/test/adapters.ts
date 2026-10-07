import { getAccountSettings } from '../shared/storage/settings';
import { createFixtureAdapter } from '../netsuite/adapter/FixtureAdapter';
import { loadFixtureSet } from '../netsuite/adapter/fixtureSet';
import type { NetSuiteAdapter } from '../netsuite/adapter/NetSuiteAdapter';
import { detectFromUrl } from '../netsuite/context/detect';
import type { PageContext } from '../netsuite/types';
import { SO_URL } from './fixtures';

export function fixtureAdapter(
  url = SO_URL,
  extra: Partial<Parameters<typeof createFixtureAdapter>[0]> = {},
): NetSuiteAdapter {
  return createFixtureAdapter({
    fixtures: loadFixtureSet(),
    allowProductionWrites: async (id) =>
      (await getAccountSettings(id)).allowProductionWrites === true,
    getTargetTab: async () => ({ id: 1, url }),
    ...extra,
  });
}

export function recordContext(url = SO_URL): PageContext & { recordType: string } {
  const ctx = detectFromUrl(url);
  if (!ctx?.recordType) throw new Error('fixture URL must be a mapped record');
  return ctx as PageContext & { recordType: string };
}
