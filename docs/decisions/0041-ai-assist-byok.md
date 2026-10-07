# ADR 0041 — AI Assist with the user's own key (BYOK)

Status: Accepted (provider list and key storage names extended by ADR 0043)

## Context

PRD-05 adds AI Assist (natural language → SuiteQL, Explain Script, Explain Error) using an
API key that the user brings, and a metadata-only AI Context Export. The extension must stay
local-first: data leaves the browser only after an explicit user action and a preview
(`docs/security-privacy.md` §2.4), keys must never be stored in plain text, and there is no
intermediary server (F-5.3).

## Decision

**Execution context.** Every provider call runs in the background service worker. The side
panel opens a `runtime.connect` port named `suitelens:ai`, sends one `start` message with an
`AiRequest` (feature, system prompt, messages), and receives `delta`, `done` or `error`
messages. All port messages have Zod schemas in `src/netsuite/bridge/protocol.ts`. Sending
`cancel` or closing the port aborts the provider request (`AbortController`), which makes
responses streaming and cancellable (NF-5.2). Only extension pages may open the port; content
scripts are rejected. Provider, model, key and limits are read in the worker from Settings
and secure storage, never from the request.

**Provider.** A small provider interface with one implementation at launch: Anthropic, through
the official `@anthropic-ai/sdk` (bundled, no remote code) with `dangerouslyAllowBrowser`
because the worker is a browser context. The model ID is a user-editable setting; the
default is only a starting value. Dev and E2E builds add a `fixture` provider that streams
canned answers, so tests never reach the network. `https://api.anthropic.com/*` is an
optional host permission requested when the user saves a key, not at install.

**Key storage.** `src/shared/storage/aiSecret.ts` is the only module that touches the key.
"Remember" stores AES-GCM ciphertext in `storage.local` under `secret:ai`, with a key derived
from a user passphrase by PBKDF2-SHA-256 (random salt and IV). The passphrase is never stored.
Unlocking (or choosing "this browser session only") places the plain key in
`storage.session` (`secret:ai:session`), which Chrome keeps in memory, clears on browser exit
and does not expose to content scripts. Delete removes both entries.

**Limits.** Optional per-request output-token cap and a local per-day token counter (input +
output reported by the provider). A request that would start after the daily cap is reached
fails with `AI_LIMIT_REACHED` before any network call.

**Privacy guard.** Each feature builds a list of payload items (question, schema summary,
script source, log entries, metadata). Before any send, a preview dialog shows every item in
full with an estimated token count; the user can edit or remove items and toggle automatic
redaction (emails, phone numbers, bank-account/tax-ID-like numbers). Cancelling sends
nothing. Record values are never added automatically; the schema context for SuiteQL is
identifier names from the partial metadata index, not record data.

**Output handling.** Responses are rendered as text (code fences become `<pre>` elements;
no HTML). Generated SuiteQL is never executed automatically: "Open in Console" places it in
a new console draft. Tables and columns are checked against the metadata index and unknown
identifiers are flagged before running. System prompts live in `src/features/ai/prompts/` and
are tested against fixed examples. NetSuite data in prompts is wrapped and labelled as data;
the AI has no tools.

**Context Export.** Generated locally from adapter metadata (record fields, sublists,
automations, custom records). No AI call, no transaction data. Copy or download as Markdown
and JSON, plus a `CLAUDE.md`/`AGENTS.md` snippet.

## Consequences

- New error codes: `AI_NOT_CONFIGURED`, `AI_LOCKED`, `AI_LIMIT_REACHED`, `AI_PROVIDER_ERROR`.
- New global setting `ai` (provider, model, limits, redaction default) and feature flags
  `aiAssist` and `aiContextExport`, both switchable in Settings.
- The extension bundles the Anthropic SDK in the background worker only.
- Losing the passphrase means re-entering the key; there is no recovery.
- More providers can be added behind the same interface without changing features.
- MCP exposure of context files (F-5.17) is deferred to v1.0.
