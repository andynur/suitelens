# Phase Prompts

Use one prompt per session, after the previous version is merged and green.
Every prompt assumes the agent already follows `CLAUDE.md`.

---

## P-0 — Kickoff (use `00-MASTER-PROMPT.md` instead)

---

## P-0.1b — Verify against a real account (after v0.1 build)

```
Read prd/PRD-01-v0.1-mvp-foundation.md and every `VERIFY` tag in src/.
Produce docs/verification/v0.1-checklist.md: for each VERIFY item, the exact manual step I should
perform in a NetSuite sandbox (page to open, what to click, what to copy from DevTools), and what
result would confirm or refute the assumption. Do not change code yet.
After I paste results back, update queries/parsers/fixtures accordingly and remove resolved VERIFY tags.
```

## P-0.2 — SuiteQL Console & Metadata Cache

```
Implement prd/PRD-02-v0.2-suiteql-console.md.
Start with a plan. Reuse NetSuiteAdapter; add runSuiteQL with paging and cancellation.
Build the metadata indexer as pluggable sources (one module per source), each with fixtures.
Use CodeMirror 6 and a virtualized table. Keep everything local; no network except same-origin.
Finish with tests, updated PRD checklist, and a short demo script I can follow in a sandbox.
```

## P-0.3 — Dev Toolbox

```
Implement prd/PRD-03-v0.3-dev-toolbox.md in this order: Record Inspector, Log Viewer,
RESTlet Tester, Command Palette.
RESTlet calls must use the user's session only; add a confirmation dialog for non-GET methods
on production accounts. Mark any uncertain NetSuite behaviour with VERIFY and add fixtures.
```

## P-0.4 — Impact Analysis

```
Implement prd/PRD-04-v0.4-impact-analysis.md.
Ship in two steps inside this session:
(1) script-file scanning + Advanced PDF template scanning (high confidence sources),
(2) pluggable stubs for saved search, workflow and form sources behind feature flags, each
returning "not checked" with a reason until verified.
Every result must carry a confidence level and its source. Add a script dependency list from define([...]).
```

## P-0.5 — AI Assist (BYOK) & AI Context Export

```
Implement prd/PRD-05-v0.5-ai-assist.md.
Provider-agnostic AI client in the background worker; model ID configurable; streaming; cancel.
Mandatory preview dialog before any send, with redaction options. API key encrypted at rest
(AES-GCM via WebCrypto, key derived from a user passphrase with PBKDF2) or session-only.
Implement NL→SuiteQL with post-validation against the metadata index, Explain Script,
Explain Error, and the AI Context Export (Markdown + JSON). Keep prompts in
src/features/ai/prompts/ with snapshot tests.
```

## P-1.0 — Public launch & MCP bridge

```
Implement prd/PRD-06-v1.0-public-launch-mcp.md.
Part A: hardening, onboarding, opt-in telemetry (event names only), docs site scaffold
(static, e.g. Astro/VitePress), store listing assets using fixture data only.
Part B: packages/mcp-bridge using the official MCP TypeScript SDK over stdio, talking to the
extension via Chrome Native Messaging. Read-only allow-listed tools; per-session approval UI
in the extension; activity log; reject non-SELECT/WITH SuiteQL. Provide install scripts for
macOS, Windows and Linux and docs for Claude Code, Claude Desktop and Cline.
```

## P-1.1 — Pro: Health Scan, Doc Generator, Licensing

```
Implement prd/PRD-07-v1.1-pro-health-docs.md.
Create a licensing module with a provider interface (start with one provider in test mode).
Community features must never call the licensing server. Implement Health Scan checks as
pluggable rules with severity, explanation and fix guidance. Implement the Documentation
Generator with Markdown and DOCX output and selectable templates.
```

## P-1.2 — Pro: Environment Diff & Cutover Builder

```
Implement prd/PRD-08-v1.2-pro-envdiff-cutover.md.
Snapshots are taken per tab with that tab's session and stored locally with account labels.
Diff engine lives in packages/core and is pure TypeScript with exhaustive tests.
Cutover output: object list for SuiteCloud CLI import, deploy/manifest skeleton (VERIFY current
SDF structure), and a Markdown/CSV checklist including manual steps for unsupported objects.
Never deploy anything directly.
```

## P-1.3 — Team / Partner

```
Implement prd/PRD-09-v1.3-team-partner.md.
Propose the minimal backend (auth + encrypted asset storage) as an ADR first and wait for approval.
Sync only shared assets (snippets, collections, templates, rules) — never NetSuite record data.
Support Chrome Enterprise managed storage for policy-controlled settings.
```

---

## Utility prompts

### Code review pass
```
Review the diff of this branch against CLAUDE.md and docs/security-privacy.md.
List violations first (security, data leaving the browser, missing VERIFY, missing tests),
then quality issues. Do not fix anything until I confirm.
```

### Add a new record type mapping
```
Add URL→record type mapping for <URL pattern> → <record type>. Add a parser test with the URL
and a fixture page. Do not change other mappings.
```

### Release
```
Prepare release vX.Y.Z: update CHANGELOG.md from commits, bump versions, run the full check,
build the zip, and draft the Chrome Web Store "What's new" text.
```
