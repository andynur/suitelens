import type { AiMessage, AiProviderId, AiRequest, AiResult } from '../types';

/** Provider implementations (F-5.1). `fixture` exists only in dev/E2E builds. */
export type AiProviderKind = AiProviderId | 'fixture';

export type AiStreamParams = {
  /** Feature that started the call. Used by the fixture provider; never sent to a real provider. */
  feature: AiRequest['feature'];
  /** Required by providers with `requiresKey`. Never logged or included in errors. */
  apiKey?: string;
  model: string;
  maxTokens: number;
  system: string;
  messages: AiMessage[];
  signal: AbortSignal;
  /** Called with each streamed text fragment, in order. */
  onDelta: (text: string) => void;
};

/**
 * One AI provider (ADR 0041). Runs in the background worker only. `stream` resolves with the
 * full text, usage and stop reason, or rejects with a `SuiteLensError`
 * (`AI_PROVIDER_ERROR`, or `CANCELLED` when `signal` aborts).
 */
export type AiProvider = {
  kind: AiProviderKind;
  requiresKey: boolean;
  stream(params: AiStreamParams): Promise<AiResult>;
};
