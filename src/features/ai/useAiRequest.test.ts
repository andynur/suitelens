import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SuiteLensError } from '../../netsuite/errors';
import type { StreamAiOptions } from './client';
import type { AiRequest, AiResult, PayloadItem } from './types';
import { useAiRequest } from './useAiRequest';

vi.mock('./client', () => ({ streamAi: vi.fn() }));
const { streamAi } = await import('./client');
const streamMock = vi.mocked(streamAi);

const ITEMS: PayloadItem[] = [
  { id: 'q', kind: 'question', label: 'Question', content: 'Hi?', required: true },
];
const build = (items: PayloadItem[]): AiRequest => ({
  feature: 'suiteql',
  system: 'sys',
  messages: [{ role: 'user', content: items.map((i) => i.content).join('\n') }],
});
const RESULT: AiResult = {
  text: 'Hello world',
  usage: { inputTokens: 3, outputTokens: 2 },
  stopReason: 'end_turn',
};

type Pending = {
  options: StreamAiOptions;
  resolve: (r: AiResult) => void;
  reject: (e: unknown) => void;
};

function deferStream(): Pending[] {
  const calls: Pending[] = [];
  streamMock.mockImplementation(
    (_request, options = {}) =>
      new Promise<AiResult>((resolve, reject) => {
        calls.push({ options, resolve, reject });
      }),
  );
  return calls;
}

beforeEach(() => {
  streamMock.mockReset();
});

it('never calls streamAi on preview or cancelPreview', () => {
  const { result } = renderHook(() => useAiRequest(build));
  act(() => result.current.preview(ITEMS));
  expect(result.current.state).toMatchObject({ status: 'preview', items: ITEMS });
  act(() => result.current.cancelPreview());
  expect(result.current.state.status).toBe('idle');
  expect(streamMock).not.toHaveBeenCalled();
});

it('streams deltas after confirm and finishes with the result', async () => {
  const calls = deferStream();
  const { result } = renderHook(() => useAiRequest(build));
  act(() => result.current.preview(ITEMS));
  act(() => result.current.confirm(ITEMS));
  expect(streamMock).toHaveBeenCalledTimes(1);
  expect(streamMock.mock.calls[0]?.[0]).toEqual(build(ITEMS));
  expect(result.current.state.status).toBe('streaming');
  act(() => {
    calls[0]!.options.onDelta?.('Hello');
    calls[0]!.options.onDelta?.(' world');
  });
  expect(result.current.state.text).toBe('Hello world');
  await act(async () => calls[0]!.resolve(RESULT));
  expect(result.current.state).toMatchObject({
    status: 'done',
    text: 'Hello world',
    result: RESULT,
  });
  expect(result.current.state.items).toEqual(ITEMS);
});

it('cancel aborts the signal, keeps partial text and ignores late results', async () => {
  const calls = deferStream();
  const { result } = renderHook(() => useAiRequest(build));
  act(() => result.current.confirm(ITEMS));
  act(() => calls[0]!.options.onDelta?.('Part'));
  act(() => result.current.cancel());
  expect(calls[0]!.options.signal?.aborted).toBe(true);
  expect(result.current.state).toMatchObject({ status: 'cancelled', text: 'Part' });
  await act(async () => {
    calls[0]!.options.onDelta?.(' late');
    calls[0]!.resolve(RESULT);
  });
  expect(result.current.state).toMatchObject({ status: 'cancelled', text: 'Part' });
});

it('maps errors to SuiteLens error shapes and CANCELLED to cancelled', async () => {
  const calls = deferStream();
  const { result } = renderHook(() => useAiRequest(build));
  act(() => result.current.confirm(ITEMS));
  await act(async () => calls[0]!.reject(new SuiteLensError('AI_LOCKED', 'locked')));
  expect(result.current.state).toMatchObject({
    status: 'error',
    error: { code: 'AI_LOCKED' },
    items: ITEMS,
  });
  act(() => result.current.confirm(ITEMS));
  await act(async () => calls[1]!.reject(new SuiteLensError('CANCELLED', 'stopped')));
  expect(result.current.state.status).toBe('cancelled');
});

it('reports build errors without calling streamAi', () => {
  const { result } = renderHook(() =>
    useAiRequest(() => {
      throw new Error('bad');
    }),
  );
  act(() => result.current.confirm(ITEMS));
  expect(result.current.state).toMatchObject({ status: 'error', error: { code: 'UNKNOWN' } });
  expect(streamMock).not.toHaveBeenCalled();
});

it('reset and unmount abort the stream and ignore late results', async () => {
  const calls = deferStream();
  const { result, unmount } = renderHook(() => useAiRequest(build));
  act(() => result.current.confirm(ITEMS));
  act(() => result.current.reset());
  expect(calls[0]!.options.signal?.aborted).toBe(true);
  await act(async () => calls[0]!.resolve(RESULT));
  expect(result.current.state.status).toBe('idle');

  act(() => result.current.confirm(ITEMS));
  unmount();
  expect(calls[1]!.options.signal?.aborted).toBe(true);
  await act(async () => calls[1]!.resolve(RESULT));
});
