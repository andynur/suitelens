import type { z } from 'zod';
import { invalidResponseError, SuiteLensError } from '../errors';
import { nonceEquals } from './nonce';
import {
  BRIDGE_REQUEST_SOURCE,
  BRIDGE_RESPONSE_SOURCE,
  BridgeDataSchemas,
  BridgeRequestSchema,
  BridgeResponseSchema,
  type BridgeOp,
  type BridgeResponse,
  type Result,
} from './protocol';

/**
 * window.postMessage transport between the content script (ISOLATED world) and the bridge
 * (MAIN world). Both sides check: same window, same origin, Zod shape, per-tab nonce.
 */

type WindowLike = Pick<Window, 'addEventListener' | 'removeEventListener' | 'postMessage'> & {
  location: { origin: string };
};

/** MAIN world side. Returns an uninstall function. */
export function installBridgeListener(
  win: WindowLike,
  nonce: string,
  handle: (op: BridgeOp) => Promise<Result<unknown>>,
): () => void {
  const listener = (event: MessageEvent) => {
    if (event.source !== (win as unknown) || event.origin !== win.location.origin) return;
    const parsed = BridgeRequestSchema.safeParse(event.data);
    if (!parsed.success || !nonceEquals(parsed.data.nonce, nonce)) return;
    const { id, payload } = parsed.data;
    void handle(payload).then((result) => {
      const response: BridgeResponse = { source: BRIDGE_RESPONSE_SOURCE, nonce, id, result };
      win.postMessage(response, win.location.origin);
    });
  };
  win.addEventListener('message', listener);
  return () => win.removeEventListener('message', listener);
}

type DataFor<K extends BridgeOp['op']> = z.infer<(typeof BridgeDataSchemas)[K]>;

export type BridgeClient = {
  call<K extends BridgeOp['op']>(
    payload: Extract<BridgeOp, { op: K }>,
    timeoutMs?: number,
  ): Promise<DataFor<K>>;
  dispose(): void;
};

/** ISOLATED world side. */
export function createBridgeClient(
  win: WindowLike,
  nonce: string,
  defaultTimeoutMs = 30_000,
): BridgeClient {
  let counter = 0;
  const pending = new Map<string, (r: BridgeResponse['result']) => void>();

  const listener = (event: MessageEvent) => {
    if (event.source !== (win as unknown) || event.origin !== win.location.origin) return;
    const parsed = BridgeResponseSchema.safeParse(event.data);
    if (!parsed.success || !nonceEquals(parsed.data.nonce, nonce)) return;
    const resolve = pending.get(parsed.data.id);
    if (!resolve) return;
    pending.delete(parsed.data.id);
    resolve(parsed.data.result);
  };
  win.addEventListener('message', listener);

  return {
    call(payload, timeoutMs = defaultTimeoutMs) {
      const id = `req-${++counter}-${Date.now().toString(36)}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new SuiteLensError('TIMEOUT', 'The page did not answer in time.'));
        }, timeoutMs);
        pending.set(id, (result) => {
          clearTimeout(timer);
          if (!result.ok) {
            reject(SuiteLensError.fromShape(result.error));
            return;
          }
          const schema = BridgeDataSchemas[payload.op];
          const data = schema.safeParse(result.data);
          if (!data.success) {
            reject(
              invalidResponseError(
                'The MAIN-world bridge returned an invalid response.',
                data.error.issues,
              ),
            );
            return;
          }
          resolve(data.data as DataFor<typeof payload.op>);
        });
        win.postMessage({ source: BRIDGE_REQUEST_SOURCE, nonce, id, payload }, win.location.origin);
      });
    },
    dispose() {
      win.removeEventListener('message', listener);
      pending.clear();
    },
  };
}
