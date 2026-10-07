import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import { streamAi } from './client';
import type { AiRequest, AiResult, PayloadItem } from './types';

export type AiRunStatus = 'idle' | 'preview' | 'streaming' | 'done' | 'error' | 'cancelled';
export type AiRunState = {
  status: AiRunStatus;
  /**
   * Items shown in the preview dialog (status 'preview'); after `confirm`, the confirmed
   * items, so Retry can re-open the preview with them.
   */
  items: PayloadItem[];
  /** Streamed text so far (or final text). */
  text: string;
  result?: AiResult;
  error?: SuiteLensErrorShape;
};

export type AiRun = {
  state: AiRunState;
  /** Opens the preview with these items. Nothing is sent yet. */
  preview(items: PayloadItem[]): void;
  /** Closes the preview without sending anything. */
  cancelPreview(): void;
  /** Sends the confirmed items: `build(items)` → `streamAi`. */
  confirm(items: PayloadItem[]): void;
  /** Aborts a running stream. */
  cancel(): void;
  reset(): void;
};

const IDLE: AiRunState = { status: 'idle', items: [], text: '' };

/**
 * Preview → confirm → stream lifecycle shared by every AI feature (F-5.10, NF-5.1, NF-5.2).
 * Nothing is sent before `confirm`, which only the preview dialog's Send button calls.
 * Every run has an id; results, deltas and errors of an aborted, reset or unmounted run are
 * ignored.
 */
export function useAiRequest(build: (items: PayloadItem[]) => AiRequest): AiRun {
  const [state, setState] = useState<AiRunState>(IDLE);
  const runId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const buildRef = useRef(build);

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  /** Invalidates the current run (if any) and aborts its network call. */
  const stop = useCallback(() => {
    runId.current += 1;
    controller.current?.abort();
    controller.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const preview = useCallback(
    (items: PayloadItem[]) => {
      stop();
      setState({ status: 'preview', items, text: '' });
    },
    [stop],
  );

  const cancelPreview = useCallback(() => {
    setState((current) => (current.status === 'preview' ? IDLE : current));
  }, []);

  const confirm = useCallback(
    (items: PayloadItem[]) => {
      stop();
      const id = runId.current;
      const isCurrent = () => runId.current === id;
      setState({ status: 'streaming', items, text: '' });
      let request: AiRequest;
      try {
        request = buildRef.current(items);
      } catch (err) {
        setState({ status: 'error', items, text: '', error: toSuiteLensError(err).toShape() });
        return;
      }
      const abort = new AbortController();
      controller.current = abort;
      streamAi(request, {
        signal: abort.signal,
        onDelta: (delta) => {
          if (!isCurrent()) return;
          setState((current) => ({ ...current, text: current.text + delta }));
        },
      }).then(
        (result) => {
          if (!isCurrent()) return;
          controller.current = null;
          setState({ status: 'done', items, text: result.text, result });
        },
        (err: unknown) => {
          if (!isCurrent()) return;
          controller.current = null;
          const error = toSuiteLensError(err);
          if (error.code === 'CANCELLED') {
            setState((current) => ({ ...current, status: 'cancelled' }));
            return;
          }
          setState((current) => ({ ...current, status: 'error', error: error.toShape() }));
        },
      );
    },
    [stop],
  );

  const cancel = useCallback(() => {
    if (!controller.current) return;
    stop();
    setState((current) =>
      current.status === 'streaming' ? { ...current, status: 'cancelled' } : current,
    );
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setState(IDLE);
  }, [stop]);

  return useMemo(
    () => ({ state, preview, cancelPreview, confirm, cancel, reset }),
    [state, preview, cancelPreview, confirm, cancel, reset],
  );
}
