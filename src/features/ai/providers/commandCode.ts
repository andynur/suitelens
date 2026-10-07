import { SuiteLensError } from '../../../netsuite/errors';
import { AI_PROVIDER_CATALOG } from '../catalog';
import { createAnthropicProvider } from './anthropic';
import { createOpenAiCompatibleProvider } from './openaiCompatible';
import type { AiProvider } from './types';

const info = AI_PROVIDER_CATALOG.commandcode;
const messagesProvider = createAnthropicProvider({
  kind: info.id,
  // The SDK appends /v1/messages itself. Both endpoints stay on the catalog origin.
  baseURL: 'https://api.commandcode.ai/provider',
  defaultHeaders: info.requestHeaders,
});

/**
 * Reviewed 2026-10-06: https://commandcode.ai/docs/provider
 * Native Claude IDs use Messages; other text models use Chat Completions.
 * VERIFY: custom model IDs, supported_endpoints, token caps and plan access with a real key.
 * Unsupported IDs fail through the existing safe provider error path; no endpoint fallback
 * or retry without ZDR is allowed.
 */
export const commandCodeProvider: AiProvider = {
  kind: info.id,
  requiresKey: true,
  stream(params) {
    if (params.model === 'typesafe/jev') {
      return Promise.reject(
        new SuiteLensError(
          'AI_PROVIDER_ERROR',
          'This decision model cannot generate text. Choose a chat model in Settings.',
        ),
      );
    }
    if (params.model.startsWith('claude-')) return messagesProvider.stream(params);
    const isOpenAiReasoningModel = /^(?:openai\/)?(?:gpt-5|o[134](?:-|$))/.test(params.model);
    return createOpenAiCompatibleProvider({
      ...info,
      maxTokensField: isOpenAiReasoningModel ? 'max_completion_tokens' : 'max_tokens',
    }).stream(params);
  },
};
