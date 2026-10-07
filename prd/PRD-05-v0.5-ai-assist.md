# PRD-05 — v0.5 AI Assist (BYOK) & AI Context Export

| | |
| --- | --- |
| Status | Implemented with Context Export gaps; live provider/account validation pending |
| Target | Feb–Mar 2027 (4 weeks) |
| Tier | Community (BYOK); hosted AI with quota = Pro (v1.1) |
| Depends on | v0.2 (metadata indexer), v0.3 (Log Viewer), v0.4 (optional) |

Progress reconciled on October 6, 2026. Checked items establish only the evidence described
below; sandbox and external acceptance remain separate. See the
[validation matrix](../docs/validation/prd01-06-matrix.md).

## 1. Goal

Make AI genuinely useful for NetSuite work **because** it gets the right account context:
schema, custom fields, scripts and real errors. Two parts:

1. **AI Assist inside the extension** (using the user's own API key).
2. **AI Context Export** for external coding agents (Claude Code, Codex, Cline), so the AI stops getting field IDs wrong.

## 2. User stories

| ID | As a | I want to | So that |
| --- | --- | --- | --- |
| US-5.1 | Admin | ask a question in plain language and get SuiteQL | I don't need to memorize tables |
| US-5.2 | Developer | get a short explanation of a script and what it does to the record | onboarding to a client account is faster |
| US-5.3 | Developer | get an explanation of an error log with likely causes | debugging is faster |
| US-5.4 | Developer | export the context of a record type (fields, sublists, scripts, workflows) as a file for Claude Code | the AI writes code with correct field IDs |
| US-5.5 | Anyone | see exactly what data will be sent to the AI | sensitive data never leaks |

## 3. Functional requirements

### 3.1 AI settings
- F-5.1 Selectable provider (start with one, multi-provider architecture); configurable model ID, never hardcoded.
- F-5.2 API key stored encrypted (passphrase) or session-only; delete-key button.
- F-5.3 AI calls from the background service worker; no intermediary server.
- F-5.4 Optional cost limits: max tokens per request and per day (counted locally).

### 3.2 Natural language → SuiteQL
- F-5.5 Question input; the context sent is a summary of the relevant schema from the metadata index (not record data).
- F-5.6 Output: SuiteQL + a short explanation; "Open in Console" button (never executed automatically).
- F-5.7 Post-generation validation: check tables/columns against the index; flag unknown ones.

### 3.3 Explain
- F-5.8 Explain Script: send the script file content (after preview) → summary, entry points, fields touched, governance risks.
- F-5.9 Explain Error: from the Log Viewer, send the selected logs + script metadata → likely causes + checks to run.

### 3.4 Privacy guard
- F-5.10 Preview dialog before every send: list of items, estimated tokens, edit/remove items.
- F-5.11 Optional automatic redaction: emails, phone numbers, numbers resembling bank accounts or tax IDs (conservative regexes).
- F-5.12 No record data (transaction/customer values) is sent unless the user adds it manually.

### 3.5 AI Context Export
- F-5.13 Generator for the active or selected record type: Markdown (`netsuite-context/<recordtype>.md`) and JSON.
- F-5.14 Contents: body & sublist fields (ID, label, type, mandatory, list source), related custom records, active scripts & deployments, workflows, general governance notes.
- F-5.15 A `CLAUDE.md`/`AGENTS.md` snippet explaining how to use the context files.
- F-5.16 No transaction data; metadata only.
- F-5.17 Can be copied, downloaded, or (v1.0) exposed as an MCP resource.

## 4. Non-functional requirements

- NF-5.1 No AI call without an explicit user action.
- NF-5.2 Streaming responses in the UI; cancellable.
- NF-5.3 System prompts live in the repo (`src/features/ai/prompts/`) and are tested against fixed examples.

## 5. Acceptance criteria

- [x] "List the 10 latest sales orders with customer names" produces valid SuiteQL for the fixture schema and opens in the Console.
  (Fixture provider answer; validated against the fixture metadata index; unit + light/dark E2E.)
- [x] Columns missing from the index are flagged before running.
- [x] The preview shows the full payload; cancelling the preview sends nothing.
- [x] AI Context Export for Sales Order produces a Markdown file with every custom body field returned
  by the fixture adapter. This does not establish complete account or custom-form coverage.
- [x] Deleting the API key really removes it from storage (verified by a test).

### Implementation checklist

- [x] AI settings (F-5.1–F-5.4): provider select (Anthropic, plus OpenAI, Gemini, Groq, DeepSeek,
  Qwen, Kimi, GLM, MiniMax and OpenRouter through one OpenAI-compatible client, ADR 0043),
  editable model ID, per-request and per-day token limits with a local daily counter, redaction
  default. Key encrypted with AES-GCM/PBKDF2 passphrase or kept for the browser session only;
  unlock, lock and delete, one key per provider; only the chosen provider's optional host
  permission is requested on save (ADR 0041).
- [x] Background-worker calls over a validated `suitelens:ai` port, streaming and cancellable
  (F-5.3, NF-5.1, NF-5.2). Official Anthropic SDK bundled; fixture provider in dev/E2E builds.
- [x] Privacy guard (F-5.10–F-5.12): preview dialog with full, editable, removable items, token
  estimate, conservative redaction and data-delimited payload. Record values are never added
  automatically.
- [x] Natural language → SuiteQL (F-5.5–F-5.7): schema summary from the partial metadata index
  (built-in common tables when no index), one SQL block plus explanation, identifier validation,
  Open in Console as a draft only.
- [x] Explain Script (F-5.8) from the AI tab (record scripts or a File Cabinet file ID) and
  Explain Error (F-5.9) for up to 20 selected Log Viewer entries/groups.
- [x] System prompts in `src/features/ai/prompts/` with fixed-example tests (NF-5.3).
- [x] AI Context Export (F-5.13–F-5.16): Markdown/JSON for the active or typed record type,
  body/sublist fields, custom records, active scripts/deployments, workflows, governance notes,
  agent snippet; copy and download (ADR 0042). F-5.14 remains partial as described below.
  MCP resource (F-5.17) is implemented locally under PRD-06; live client validation remains open.
- [ ] Validate with a real provider key and account: model IDs/limits and endpoint
  details per provider (catalog `VERIFY:`), SuiteQL prompt
  facts marked `VERIFY:` (type codes, ROWNUM top-N, `BUILTIN.DF`), redaction false positives.
- [x] Command Code BYOK: one key, fixed optional host, Claude Messages / other text-model
  Chat Completions routing, required ZDR with no fallback, Settings/preview disclosures
  (ADR 0049). Gemini model suggestions and unpaid-service privacy disclosure reviewed
  against official documentation on October 6, 2026. Automated/fixture validation only.
- [ ] Validate Command Code and Gemini with real keys: plan/model access, endpoint and
  token-cap compatibility, SDK headers, streamed usage/thinking, ZDR rejection and installed
  extension permissions. Research model-catalog probe returned HTTP 403.
- [x] F-5.14 partial: active custom body/column list-source enrichment through separate,
  bounded metadata reads and local mapping (ADR 0045). Custom-record ID matches and unique
  display-name candidates carry provenance; ambiguous/unmapped sources omit identifiers.
  Fixture unit and light/dark browser coverage; standalone metadata probes supplied manually.
- [ ] F-5.14: validate integrated parameterized list-source reads and restricted-role access;
  resolve custom lists, renamed/unmatched labels and standard-field sources with stable identity.
- [x] F-5.14 partial: derive outgoing related custom records from active body/sublist list sources
  with exact custom-record ID matches; include field/sublist provenance and keep the account
  index separate (ADR 0046, schema version 2). Name-only candidates are excluded.
- [ ] F-5.14: validate outgoing relationships through the installed adapter/native definitions;
  add verified incoming references and coverage beyond active custom body/column fields.
- [x] F-5.13/F-5.14 partial: export selected custom record definition identifiers separately
  from active body/sublist fields, using the existing metadata mapper (ADR 0047). Exact type
  match, partial/not-checked status; no invented field attributes or relationships.
- [ ] F-5.13/F-5.14: validate selected custom record definition joins/role coverage and add a
  complete schema source for non-active types. Body/sublist field reads still require an open record.

## 6. Out of scope

AI that writes to NetSuite, autonomous agents, hosted AI (Pro, v1.1), MCP bridge (v1.0).
