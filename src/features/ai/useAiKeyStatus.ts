import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { AI_SECRET_PREFIX, getAiKeyInfo } from '../../shared/storage/aiSecret';
import { useAppStore } from '../../shared/store';
import type { AiProviderId } from './catalog';

export type AiKeyStatus = 'loading' | 'none' | 'locked' | 'ready';

/**
 * Live key status of a provider (default: the one selected in Settings) for gating AI
 * features. Follows local and session storage changes.
 */
export function useAiKeyStatus(provider?: AiProviderId): AiKeyStatus {
  const selected = useAppStore((s) => s.settings.ai.provider);
  const id = provider ?? selected;
  const [state, setState] = useState<{ id: AiProviderId; status: AiKeyStatus }>({
    id,
    status: 'loading',
  });
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void getAiKeyInfo(id)
        .then((info) => {
          if (!active) return;
          setState({
            id,
            status: info.stored === 'none' ? 'none' : info.unlocked ? 'ready' : 'locked',
          });
        })
        .catch(() => {
          if (active) setState({ id, status: 'none' });
        });
    refresh();
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area !== 'local' && area !== 'session') return;
      if (Object.keys(changes).some((key) => key.startsWith(AI_SECRET_PREFIX))) refresh();
    };
    browser.storage.onChanged.addListener(listener);
    return () => {
      active = false;
      browser.storage.onChanged.removeListener(listener);
    };
  }, [id]);
  // A status read for another provider is stale until the effect above refreshes it.
  return state.id === id ? state.status : 'loading';
}
