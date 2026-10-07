/**
 * AI provider catalog (PRD-05 F-5.1, ADR 0043). Pure data, no browser APIs: imported by
 * Settings, the background worker and `wxt.config.ts` (optional host permissions).
 *
 * Providers use Anthropic Messages or OpenAI Chat Completions; Command Code routes by model.
 * Endpoints are fixed here (never user-entered) so the extension only ever asks for host
 * access to these origins.
 *
 * VERIFY: base URLs, the max-tokens field name, `stream_options.include_usage` support and the
 * suggested model IDs against each provider's current docs. Model IDs change often; the user
 * can always type any ID in Settings.
 */
export const AI_PROVIDERS = [
  'anthropic',
  'openai',
  'gemini',
  'groq',
  'deepseek',
  'qwen',
  'moonshot',
  'zhipu',
  'minimax',
  'openrouter',
  'commandcode',
] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export type AiProviderInfo = {
  id: AiProviderId;
  /** Display name (product names are not translated). */
  label: string;
  protocol: 'anthropic' | 'openai' | 'commandcode';
  /** Base URL; `/chat/completions` is appended for the OpenAI protocol. */
  baseUrl: string;
  /** Match pattern requested as an optional host permission when a key is saved. */
  origin: string;
  defaultModel: string;
  suggestedModels: readonly string[];
  /** OpenAI protocol only: name of the output-token cap in the request body. */
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
  /** OpenAI protocol only: send `stream_options: { include_usage: true }`. */
  streamUsage?: boolean;
  /** Fixed provider headers only; never populated from Settings or page data. */
  requestHeaders?: Readonly<Record<string, string>>;
  /** Where the user creates a key (shown as plain text, never fetched). */
  keyPage: string;
};

export const AI_PROVIDER_CATALOG: Record<AiProviderId, AiProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    origin: 'https://api.anthropic.com/*',
    defaultModel: 'claude-opus-5-5',
    suggestedModels: [
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-fable-5-1',
      'claude-haiku-4-5-20251001',
    ],
    keyPage: 'console.anthropic.com',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT, Codex)',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    origin: 'https://api.openai.com/*',
    defaultModel: 'gpt-5',
    suggestedModels: ['gpt-5', 'gpt-5-mini', 'gpt-5-codex', 'gpt-4.1'],
    // Newer OpenAI models reject `max_tokens`.
    maxTokensField: 'max_completion_tokens',
    streamUsage: true,
    keyPage: 'platform.openai.com/api-keys',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    protocol: 'openai',
    // Gemini's OpenAI-compatible endpoint.
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    origin: 'https://generativelanguage.googleapis.com/*',
    // Reviewed 2026-10-06: https://ai.google.dev/gemini-api/docs/models
    // Existing saved model IDs stay unchanged; 2.5 access is restricted for new projects.
    defaultModel: 'gemini-3.8-flash',
    suggestedModels: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'],
    maxTokensField: 'max_tokens',
    streamUsage: true,
    keyPage: 'aistudio.google.com/apikey',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    origin: 'https://api.groq.com/*',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'],
    maxTokensField: 'max_tokens',
    streamUsage: true,
    keyPage: 'console.groq.com/keys',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com',
    origin: 'https://api.deepseek.com/*',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    maxTokensField: 'max_tokens',
    streamUsage: true,
    keyPage: 'platform.deepseek.com/api_keys',
  },
  qwen: {
    id: 'qwen',
    label: 'Alibaba Qwen (DashScope International)',
    protocol: 'openai',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    origin: 'https://dashscope-intl.aliyuncs.com/*',
    defaultModel: 'qwen-plus',
    suggestedModels: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-coder-plus'],
    maxTokensField: 'max_tokens',
    streamUsage: true,
    keyPage: 'modelstudio.console.alibabacloud.com',
  },
  moonshot: {
    id: 'moonshot',
    label: 'Moonshot AI (Kimi)',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.ai/v1',
    origin: 'https://api.moonshot.ai/*',
    defaultModel: 'kimi-k2-turbo-preview',
    suggestedModels: ['kimi-k2-turbo-preview', 'kimi-k2-0905-preview', 'moonshot-v1-32k'],
    maxTokensField: 'max_tokens',
    // Usage arrives in the last chunk without `stream_options`.
    streamUsage: false,
    keyPage: 'platform.moonshot.ai',
  },
  zhipu: {
    id: 'zhipu',
    label: 'Zhipu GLM (Z.ai)',
    protocol: 'openai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    origin: 'https://api.z.ai/*',
    defaultModel: 'glm-4.6',
    suggestedModels: ['glm-4.6', 'glm-4.5', 'glm-4.5-air'],
    maxTokensField: 'max_tokens',
    streamUsage: false,
    keyPage: 'z.ai/manage-apikey/apikey-list',
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    protocol: 'openai',
    baseUrl: 'https://api.minimax.io/v1',
    origin: 'https://api.minimax.io/*',
    defaultModel: 'MiniMax-M2',
    suggestedModels: ['MiniMax-M2'],
    maxTokensField: 'max_tokens',
    streamUsage: false,
    keyPage: 'platform.minimax.io',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (many models)',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    origin: 'https://openrouter.ai/*',
    defaultModel: 'openai/gpt-5',
    suggestedModels: [
      'openai/gpt-5',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-2.5-pro',
      'deepseek/deepseek-chat',
      'qwen/qwen3-coder',
      'moonshotai/kimi-k2',
      'z-ai/glm-4.6',
    ],
    maxTokensField: 'max_tokens',
    streamUsage: true,
    keyPage: 'openrouter.ai/keys',
  },
  commandcode: {
    id: 'commandcode',
    label: 'Command Code',
    protocol: 'commandcode',
    baseUrl: 'https://api.commandcode.ai/provider/v1',
    origin: 'https://api.commandcode.ai/*',
    defaultModel: 'deepseek/deepseek-v4-flash',
    suggestedModels: ['deepseek/deepseek-v4-flash', 'claude-sonnet-4-6'],
    maxTokensField: 'max_tokens',
    streamUsage: true,
    requestHeaders: { 'x-cmd-zdr': '1' },
    keyPage: 'commandcode.ai (Studio API keys)',
  },
};

/** Every provider origin, for `optional_host_permissions`. */
export const AI_PROVIDER_ORIGINS: string[] = AI_PROVIDERS.map(
  (id) => AI_PROVIDER_CATALOG[id].origin,
);

/** Host shown to the user ("sent to …"). */
export function providerHost(id: AiProviderId): string {
  return new URL(AI_PROVIDER_CATALOG[id].baseUrl).host;
}
