/** Minimal window with postMessage semantics for bridge transport tests. */
export function createFakeWindow(origin = 'https://1234567.app.netsuite.com') {
  type Listener = (event: MessageEvent) => void;
  const listeners = new Set<Listener>();
  const win = {
    location: { origin },
    addEventListener: (_type: string, l: Listener) => listeners.add(l),
    removeEventListener: (_type: string, l: Listener) => listeners.delete(l),
    postMessage: (data: unknown) => dispatch(data),
  };
  const dispatch = (data: unknown, opts: { origin?: string; source?: unknown } = {}) => {
    queueMicrotask(() => {
      const event = {
        data,
        origin: opts.origin ?? origin,
        source: opts.source ?? win,
      } as unknown as MessageEvent;
      for (const l of Array.from(listeners)) l(event);
    });
  };
  return {
    win: win as typeof win &
      Pick<Window, 'addEventListener' | 'removeEventListener' | 'postMessage'>,
    dispatch,
    listeners,
  };
}
