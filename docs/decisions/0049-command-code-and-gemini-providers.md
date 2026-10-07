# ADR 0049 — Command Code routing and Gemini provider review

Status: Accepted

## Context

Users want to use a Command Code API key for AI Assist and current Google Gemini text
models. ADR 0043 assumes one protocol per provider, but Command Code serves native Claude
IDs through Anthropic Messages and other text models through OpenAI Chat Completions.

## Decision

Add one `commandcode` provider and one secure-storage key. Its fixed API origin is
`https://api.commandcode.ai/*`, requested only when saving that provider's key. Native
`claude-` model IDs use the bundled Anthropic SDK with the fixed base URL
`https://api.commandcode.ai/provider` (the SDK appends `/v1/messages`). Other text IDs use
the existing Chat Completions client at `/provider/v1/chat/completions`. GPT-5 and o1/o3/o4
IDs use `max_completion_tokens`; other models use `max_tokens`. The decision-only
`typesafe/jev` model is rejected locally. No tool execution or CLI integration is added.

Every Command Code request includes `x-cmd-zdr: 1`. There is no fallback that removes
this header. Settings and the payload preview explain forwarding to the model provider,
required zero data retention, possible routing-dependent pricing and plan-credit usage.
This is enforcement of the vendor's documented request option, not an independent audit
of its retention practices. Unknown model IDs retain safe HTTP error handling; no model
catalog is fetched automatically and no page or Settings input can choose an endpoint.

Keep Gemini on its official OpenAI-compatible endpoint with Bearer authentication and
SSE streaming. Update the selection default to `gemini-3.8-flash`, with
`gemini-3.5-flash-lite` and `gemini-3.1-pro-preview` suggestions. Saved model selections
remain untouched. Google now restricts 2.5 access for new projects. This integration is
for text generation; Live, TTS, image generation and tools are outside AI Assist's scope.
Thinking remains at model defaults. The provider's completion-token count is counted
as reported, without adding reasoning detail a second time; unavailable usage remains
an estimate. Output caps can truncate thinking-model answers.

Show Gemini's unpaid-service data-use warning in Settings and every preview. Paid-service
terms require a project with active Cloud Billing; regional exceptions apply. SuiteLens
cannot determine the key's billing status and does not promise zero retention for Gemini.

## Consequences and validation

- Existing encrypted/session key storage, explicit preview, cancellation, Safe mode and
  local token limits are reused. There is no new dependency or intermediary SuiteLens server.
- Tests cover request routing, ZDR headers/no fallback, endpoint/key/usage behavior,
  provider resolution, separate saved keys/permissions and preview disclosures.
- Fixture E2E covers selecting providers and seeing Gemini's disclosure before sending.
  Fixture answers do not establish live provider compatibility.
- VERIFY: Command Code model `supported_endpoints`, per-model caps, plan availability,
  SDK headers, browser permissions and streaming with real keys. An unauthenticated
  models probe returned HTTP 403 from the research environment.
- VERIFY: Gemini model access, thinking/truncation behavior, streamed token accounting,
  rate limits and billing/privacy status with a real project key.

## Sources reviewed October 6, 2026

- [Command Code Provider API](https://commandcode.ai/docs/provider)
- [Command Code ZDR](https://commandcode.ai/docs/resources/zdr)
- [Command Code Privacy Policy](https://commandcode.ai/privacy)
- [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
