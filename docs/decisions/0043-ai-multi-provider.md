# ADR 0043 — AI Assist: multiple BYOK providers

Status: Accepted

## Context

ADR 0041 shipped AI Assist with one provider (Anthropic) behind a provider interface. Users
want to bring the key they already have: OpenAI (GPT, Codex), Google Gemini, Groq, and popular
Chinese models (DeepSeek, Qwen, Kimi, GLM, MiniMax). Every request still has to follow the
same rules: explicit user action, preview first, key only in the secure-storage module, no
remote code, and no broad host permissions.

## Decision

**Fixed catalog.** `src/features/ai/catalog.ts` lists each provider with its label, fixed base
URL, origin, default and suggested model IDs, and wire details. Endpoints are not
user-editable, so the manifest can declare an exact `optional_host_permissions` list
(generated from the catalog) and the extension never needs `https://*/*`. Supported:
Anthropic, OpenAI, Gemini, Groq, DeepSeek, Qwen (DashScope International), Moonshot (Kimi),
Zhipu GLM (Z.ai), MiniMax and OpenRouter (which covers further models).

**Two protocols.** Anthropic keeps the official SDK (ADR 0041). All other providers expose the
OpenAI Chat Completions format, so one client (`providers/openaiCompatible.ts`) handles them:
`fetch` + server-sent events in the background worker, `credentials: 'omit'`, the key only in
the `Authorization` header, and only model, messages, the output-token cap and stream flags
in the body. Per-provider details are data in the catalog: the max-tokens field name
(`max_completion_tokens` for OpenAI) and whether to ask for streamed usage. When a provider
reports no usage, tokens are estimated (4 characters per token) so the daily limit still
counts. Finish reasons map to the existing stop reasons (`length` → `max_tokens`,
`content_filter` → `refusal`). Error bodies are never read; errors carry only the HTTP status.
A lint exception allows `fetch` in that one file only.

**One key per provider.** Keys live under `secret:ai:<provider>` (local, encrypted) and
`secret:ai:session:<provider>` (session). Switching provider keeps other keys; the key
section names the provider and where to create a key. Saving a key requests only that
provider's origin.

**Model per selection.** Switching provider resets the model field to that provider's
default. The field suggests known model IDs and accepts any ID, including `vendor/model`
for OpenRouter.

**Transparency.** Settings and the preview dialog name the provider and its host. Settings
asks the user to check the provider's data-retention terms; data residency differs by
provider (some are hosted outside the user's region).

## Consequences

- No new dependency; the OpenAI-compatible client is about 250 lines with unit tests.
- Adding a provider that speaks the same format is a catalog entry plus its origin.
- Providers with China-only endpoints (`dashscope.aliyuncs.com`, `api.moonshot.cn`,
  `open.bigmodel.cn`) and local servers (Ollama) are not included; a custom endpoint would
  need a broad host permission and is out of scope for now.
- VERIFY: base URLs, the max-tokens field, streamed-usage support and the suggested model IDs
  against each provider's current documentation with a real key.
