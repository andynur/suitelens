import { useEffect, useState } from 'react';
import {
  accountKey,
  getAccountSettings,
  onStorageChange,
  type AccountSettings,
} from '../storage/settings';

const EMPTY: AccountSettings = {};

/** Per-account settings, kept in sync with storage changes from any context. */
export function useAccountSettings(accountId: string | undefined): AccountSettings {
  const [state, setState] = useState<{ accountId: string; settings: AccountSettings }>();
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const load = () =>
      void getAccountSettings(accountId).then((settings) => {
        if (!cancelled) setState({ accountId, settings });
      });
    load();
    const key = accountKey(accountId, 'settings');
    const unsubscribe = onStorageChange((keys) => {
      if (keys.includes(key) || keys.length === 0) load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [accountId]);
  return state && state.accountId === accountId ? state.settings : EMPTY;
}
