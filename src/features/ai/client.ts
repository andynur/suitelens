import { browser } from 'wxt/browser';
import { AI_PORT_NAME, AiPortServerMessageSchema } from '../../netsuite/bridge/protocol';
import { SuiteLensError } from '../../netsuite/errors';
import type { AiRequest, AiResult } from './types';

export type StreamAiOptions = {
  signal?: AbortSignal;
  /** Called with each streamed text fragment, in order. */
  onDelta?: (text: string) => void;
};

/**
 * Side-panel entry point for every AI call (ADR 0041). Opens an `AI_PORT_NAME` port to the
 * background worker, streams deltas, and resolves with the full text and usage. Aborting the
 * signal cancels the provider call. Rejects with a `SuiteLensError` (e.g. AI_NOT_CONFIGURED,
 * AI_LOCKED, AI_LIMIT_REACHED, AI_PROVIDER_ERROR, CANCELLED).
 *
 * Callers must only call this after the user confirmed the preview dialog (F-5.10, NF-5.1).
 */
export async function streamAi(
  request: AiRequest,
  options: StreamAiOptions = {},
): Promise<AiResult> {
  const { signal, onDelta } = options;
  if (signal?.aborted) throw cancelled();

  const port = browser.runtime.connect({ name: AI_PORT_NAME });

  return new Promise<AiResult>((resolve, reject) => {
    let text = '';
    let settled = false;

    const finish = (outcome: () => void, disconnect: boolean) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      if (disconnect) {
        try {
          port.disconnect();
        } catch {
          // Already closed.
        }
      }
      outcome();
    };

    const onAbort = () => {
      if (settled) return;
      try {
        port.postMessage({ type: 'cancel' });
      } catch {
        // Port already closed; disconnecting is enough.
      }
      finish(() => reject(cancelled()), true);
    };

    port.onMessage.addListener((raw: unknown) => {
      if (settled) return;
      const parsed = AiPortServerMessageSchema.safeParse(raw);
      if (!parsed.success) {
        finish(
          () =>
            reject(
              new SuiteLensError('INVALID_RESPONSE', 'The AI service returned an invalid message.'),
            ),
          true,
        );
        return;
      }
      const message = parsed.data;
      switch (message.type) {
        case 'delta':
          text += message.text;
          onDelta?.(message.text);
          return;
        case 'done':
          finish(
            () =>
              resolve({
                text,
                usage: message.usage,
                ...(message.stopReason ? { stopReason: message.stopReason } : {}),
              }),
            true,
          );
          return;
        case 'error':
          finish(() => reject(SuiteLensError.fromShape(message.error)), true);
          return;
      }
    });

    port.onDisconnect.addListener(() => {
      finish(
        () =>
          reject(
            new SuiteLensError(
              'AI_PROVIDER_ERROR',
              'The AI request ended unexpectedly. Retry, or reload SuiteLens if it keeps happening.',
            ),
          ),
        false,
      );
    });

    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      port.postMessage({ type: 'start', request });
    } catch {
      finish(
        () =>
          reject(
            new SuiteLensError(
              'AI_PROVIDER_ERROR',
              'Cannot reach the SuiteLens background worker.',
            ),
          ),
        true,
      );
    }
  });
}

function cancelled(): SuiteLensError {
  return new SuiteLensError('CANCELLED', 'The AI request was cancelled.');
}
