import { SuiteLensError } from '../../../netsuite/errors';
import { EXPLAIN_ERROR_FIXTURE_ANSWER } from '../prompts/explainError';
import { EXPLAIN_SCRIPT_FIXTURE_ANSWER } from '../prompts/explainScript';
import { SUITEQL_FIXTURE_ANSWER } from '../prompts/suiteql';
import type { AiRequest, AiResult } from '../types';
import type { AiProvider, AiStreamParams } from './types';

const FALLBACK_ANSWER = 'Fixture answer';

const ANSWERS: Record<AiRequest['feature'], string> = {
  suiteql: SUITEQL_FIXTURE_ANSWER,
  explainScript: EXPLAIN_SCRIPT_FIXTURE_ANSWER,
  explainError: EXPLAIN_ERROR_FIXTURE_ANSWER,
};

export type FixtureProviderOptions = {
  /** Characters per streamed chunk. */
  chunkSize?: number;
  /** Delay between chunks in milliseconds. */
  delayMs?: number;
};

export function fixtureAnswer(feature: AiRequest['feature']): string {
  return ANSWERS[feature] || FALLBACK_ANSWER;
}

/**
 * Dev/E2E provider (ADR 0041): streams the feature's canned answer in small chunks without any
 * network call. Needs no key. Usage is estimated as characters / 4.
 */
export function createFixtureProvider(options: FixtureProviderOptions = {}): AiProvider {
  const chunkSize = Math.max(1, options.chunkSize ?? 24);
  const delayMs = Math.max(0, options.delayMs ?? 15);
  return {
    kind: 'fixture',
    requiresKey: false,
    async stream(params: AiStreamParams): Promise<AiResult> {
      if (!__SUITELENS_FIXTURES__) {
        throw new SuiteLensError('UNSUPPORTED', 'The fixture AI provider is not available.');
      }
      const { feature, system, messages, maxTokens, signal, onDelta } = params;
      const answer = fixtureAnswer(feature).slice(0, maxTokens * 4);
      let text = '';
      for (let i = 0; i < answer.length; i += chunkSize) {
        await wait(delayMs, signal);
        const chunk = answer.slice(i, i + chunkSize);
        text += chunk;
        onDelta(chunk);
      }
      if (signal.aborted) throw cancelled();
      const inputChars = system.length + messages.reduce((sum, m) => sum + m.content.length, 0);
      return {
        text,
        usage: { inputTokens: Math.ceil(inputChars / 4), outputTokens: Math.ceil(text.length / 4) },
        stopReason: 'end_turn',
      };
    },
  };
}

function cancelled(): SuiteLensError {
  return new SuiteLensError('CANCELLED', 'The AI request was cancelled.');
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(cancelled());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(cancelled());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
