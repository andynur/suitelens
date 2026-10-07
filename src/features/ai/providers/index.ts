import type { Settings } from '../../../shared/storage/settings';
import { AI_PROVIDER_CATALOG } from '../catalog';
import { anthropicProvider } from './anthropic';
import { commandCodeProvider } from './commandCode';
import { createFixtureProvider } from './fixture';
import { createOpenAiCompatibleProvider } from './openaiCompatible';
import type { AiProvider } from './types';

export type { AiProvider, AiProviderKind, AiStreamParams } from './types';

/**
 * Same rule as `effectiveAdapterMode` in `src/shared/adapter.ts`, replicated so the background
 * worker does not bundle the NetSuite adapters. Production builds always resolve to live.
 */
export function usesFixtureProvider(settings: Pick<Settings, 'adapterMode'>): boolean {
  if (!__SUITELENS_FIXTURES__) return false;
  return (settings.adapterMode ?? __SUITELENS_DEFAULT_ADAPTER__) === 'fixture';
}

/**
 * Picks the provider for a request (F-5.1): the canned `fixture` provider when the effective
 * adapter mode is fixture (dev/E2E builds only), otherwise the provider chosen in Settings.
 */
export async function resolveAiProvider(
  settings: Pick<Settings, 'adapterMode' | 'ai'>,
): Promise<AiProvider> {
  // Static import: Chrome forbids dynamic import() in extension service workers. The call is
  // dead code in production builds (`__SUITELENS_FIXTURES__` is constant false).
  if (usesFixtureProvider(settings)) return createFixtureProvider();
  const info = AI_PROVIDER_CATALOG[settings.ai.provider];
  if (info.protocol === 'commandcode') return commandCodeProvider;
  return info.protocol === 'anthropic' ? anthropicProvider : createOpenAiCompatibleProvider(info);
}
