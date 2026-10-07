import { z } from 'zod';
import { AI_PROVIDER_CATALOG } from './catalog';

/**
 * AI Assist contracts shared by the side panel, the background worker and every AI feature
 * (PRD-05, ADR 0041). Keep this module free of browser APIs.
 */

export { AI_PROVIDERS, type AiProviderId } from './catalog';

/** Starting value for the model field. Users can change it in Settings (never hardcoded in calls). */
export const DEFAULT_AI_MODEL = AI_PROVIDER_CATALOG.anthropic.defaultModel;

/** Model IDs: letters, digits, `. _ : - /` (OpenRouter uses `vendor/model`). */
export const AI_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,99}$/i;

/** Upper bound for one request's text payload (characters), checked before sending. */
export const MAX_AI_PAYLOAD_CHARS = 400_000;

export const AiMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(MAX_AI_PAYLOAD_CHARS),
});
export type AiMessage = z.infer<typeof AiMessageSchema>;

/**
 * One AI call. Provider, model, key and limits come from Settings in the background worker,
 * never from the request.
 */
export const AiRequestSchema = z.object({
  /** Which feature started the call (logging and tests only; never sent to the provider). */
  feature: z.enum(['suiteql', 'explainScript', 'explainError']),
  system: z.string().max(50_000),
  messages: z.array(AiMessageSchema).min(1).max(20),
});
export type AiRequest = z.infer<typeof AiRequestSchema>;

export const AiUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});
export type AiUsage = z.infer<typeof AiUsageSchema>;

export type AiResult = {
  text: string;
  usage: AiUsage;
  /** Provider stop reason, e.g. "end_turn", "max_tokens", "refusal". */
  stopReason?: string;
};

/**
 * One item of the payload shown in the preview dialog (F-5.10). The user can edit or remove
 * items before sending. Record data is never added automatically (F-5.12); `record` items
 * exist only when the user adds them by hand.
 */
export const PayloadItemKindSchema = z.enum([
  'question',
  'schema',
  'script',
  'metadata',
  'log',
  'record',
  'note',
]);
export type PayloadItemKind = z.infer<typeof PayloadItemKindSchema>;

export type PayloadItem = {
  id: string;
  kind: PayloadItemKind;
  /** Short label shown in the preview list, e.g. "Schema: transaction (42 columns)". */
  label: string;
  content: string;
  /** Items the request cannot work without (e.g. the question) can be edited but not removed. */
  required?: boolean;
};
