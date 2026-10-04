# PRD-05 — v0.5 AI Assist (BYOK) & AI Context Export

| | |
| --- | --- |
| Status | Draft |
| Target | Feb–Mar 2027 (4 weeks) |
| Tier | Community (BYOK); hosted AI with quota = Pro (v1.1) |
| Depends on | v0.2 (metadata indexer), v0.3 (Log Viewer), v0.4 (optional) |

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

- [ ] "List the 10 latest sales orders with customer names" produces valid SuiteQL for the fixture schema and opens in the Console.
- [ ] Columns missing from the index are flagged before running.
- [ ] The preview shows the full payload; cancelling the preview sends nothing.
- [ ] AI Context Export for Sales Order produces a Markdown file with every custom body field.
- [ ] Deleting the API key really removes it from storage (verified by a test).

## 6. Out of scope

AI that writes to NetSuite, autonomous agents, hosted AI (Pro, v1.1), MCP bridge (v1.0).
