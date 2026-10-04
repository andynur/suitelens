import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: SuiteLensErrorShape };

type Settled<T> = { key: string; token: number; value: AsyncState<T> };

/**
 * Runs `load` whenever `key` changes; ignores stale results. `reload(true)` re-runs with
 * `force = true` (e.g. a refresh button bypassing caches).
 */
export function useAsync<T>(load: (force: boolean) => Promise<T>, key: string | null) {
  const [token, setToken] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>();
  const loadRef = useRef(load);
  const forceRef = useRef(false);

  useLayoutEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    let current = true;
    const force = forceRef.current;
    forceRef.current = false;
    loadRef.current(force).then(
      (data) => {
        if (current) setSettled({ key, token, value: { status: 'success', data } });
      },
      (err: unknown) => {
        if (current) {
          setSettled({
            key,
            token,
            value: { status: 'error', error: toSuiteLensError(err).toShape() },
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [key, token]);

  const reload = useCallback((force: boolean) => {
    forceRef.current = force;
    setToken((n) => n + 1);
  }, []);

  const state: AsyncState<T> =
    settled && settled.key === key && settled.token === token
      ? settled.value
      : { status: 'loading' };
  return { ...state, reload };
}
