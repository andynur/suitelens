# PRD-06 — v1.0 Public Launch & Local MCP Bridge

| | |
| --- | --- |
| Status | Implemented locally; external launch gates pending |
| Target | March 2027 (3–4 weeks) |
| Tier | Community |
| Depends on | v0.1–v0.5 |

Progress reconciled on October 6, 2026. Local implementation and external release gates
remain separate. See the [validation matrix](../docs/validation/prd01-06-matrix.md).

## 1. Goal

1. Ship a stable public release on the Chrome Web Store with documentation, a website and community channels.
2. Provide a **local MCP bridge** so coding agents (Claude Code, Claude Desktop, Cline, etc.) can read
   NetSuite context from the user's browser session, safely and read-only.

## 2. Part A — Launch readiness

- F-6.1 Hardening: error boundaries on every tab, friendly error messages, "safe mode" (all features off except Settings).
- F-6.2 3-step onboarding on first open (what it is, privacy, try it on a record page).
- F-6.3 Documentation website (static site): install, features, privacy policy, security, FAQ, changelog, public roadmap.
- F-6.4 Chrome Web Store listing: description, screenshots from fixture data (never client data), a 60–90 second demo video, permission justifications.
- F-6.5 `SECURITY.md`, `CONTRIBUTING.md`, issue templates, "good first issue" labels.
- F-6.6 **Opt-in** telemetry (feature events only, never record data) and a page explaining exactly what is collected.
- F-6.7 Unobtrusive "Hire / Services" page (linked from About and the website).
- F-6.8 Sponsorship links: GitHub Sponsors, Ko-fi / Buy Me a Coffee.

## 3. Part B — Local MCP bridge

### Architecture
```
Coding agent (MCP client) ──stdio──► netsuite-suitelens-mcp (Node, MCP SDK)
                                         │ Native Messaging
                                         ▼
                                  Extension background ──► content/bridge ──► NetSuite (user session)
```

### Requirements
- F-6.9 Package `packages/mcp-bridge`, published to npm as `netsuite-suitelens-mcp`, installable with a single command; the installer writes the Chrome Native Messaging manifest for the user's OS.
- F-6.10 Read-only, allow-listed tools: `get_page_context`, `get_record_schema(recordType)`, `get_automations(recordType)`, `run_suiteql(sql, params, limit)` with a row cap, `where_used(id)`, `get_script_source(scriptId)`.
- F-6.11 Resources: AI Context files per record type.
- F-6.12 Per-session approval in the extension: "Agent X is requesting access to account 1234567-sb1 (sandbox) — allow for 1 hour / deny". Production is denied by default unless the user allows it per account.
- F-6.13 MCP activity log in the extension (tool, time, account, row count), deletable.
- F-6.14 Setup docs for Claude Code, Claude Desktop and Cline.
- F-6.15 Guidance alongside Oracle's official AI Connector Service: when to use the local bridge (developer exploration, sandbox) vs the AI Connector (official OAuth/role-based usage).

## 4. Non-functional requirements

- NF-6.1 The bridge opens no network ports; stdio + Native Messaging only.
- NF-6.2 Every tool input is validated with Zod; `run_suiteql` rejects anything other than `SELECT`/`WITH`.
- NF-6.3 Per-session rate limiting for agents.

## 5. Acceptance criteria

- [ ] The Web Store listing is approved; public install works.
- [ ] The docs website is live with a privacy policy.
- [ ] From Claude Code, `get_record_schema("salesorder")` returns the sandbox schema after the user approves in the extension.
- [x] Without approval, every tool returns a clear "not authorized" error (unit/transport proof; live client verification still required).
- [x] `run_suiteql` with `DELETE`/`UPDATE` is rejected (shared guard, unit and SDK transport tests).

### Implementation checklist

- [x] F-6.1 Render-error boundary per side-panel tab (remounts on page/account change, retry,
  Open Settings) plus a root boundary for header and overlays; crash detail is collapsed and
  kept in the local view only, never logged (including React caught-error diagnostics).
- [x] F-6.1 Safe mode in Settings: every feature off (including page banner and field ID badges)
  without touching the stored toggles; the background AI handler honours it too.
- [x] F-6.2 Three-step first-open onboarding, explicit skip/completion, save-failure recovery and Settings replay. Deleting all data resets the tour.
- [x] F-6.3 Static docs sources for install/features/privacy/security/FAQ/changelog/roadmap, 12-page build with link checks, responsive browser QA and manual Pages workflow.
- [x] F-6.4 Store listing/permission justifications plus five 1280×800 fixture screenshots and a 75-second recorded fixture demo. No client data; submission pending.
- [x] F-6.5 SECURITY/CONTRIBUTING and scoped issue template; `good first issue` label verified on GitHub and private vulnerability reporting enabled October 6, 2026.
- [x] F-6.6 Opt-in local feature-open counters, exact collection disclosure, inspection/copy/deletion. No automatic upload, identifier, account or record data.
- [x] F-6.7 Services page linked from About and docs; dedicated contact still needs maintainer configuration.
- [ ] F-6.8 Configure verified active GitHub Sponsors and Ko-fi / Buy Me a Coffee URLs. Support page and About/docs link are ready; no destination is invented.
- [x] F-6.9 Node MCP package, CLI and OS-aware Native Messaging registration/uninstall; packed-artifact clean install and macOS temporary-home registration tested.
- [x] F-6.10 Six strict read-only tools through NetSuiteAdapter; schema strips values, SQL caps at 1,000 rows, script internal/`customscript_` IDs resolve to file IDs and optional folder metadata, Where used scans at most 20 script files with conservative coverage.
- [x] F-6.11 On-demand metadata-only AI Context Markdown resource template per record type, under the same approval/rate guard.
- [x] F-6.12 One-hour session/account/pinned-page approval, production opt-in separate from writes, unknown environments denied, per-read authorization and revocation/discard on navigation, Safe mode, disconnect and restart.
- [x] F-6.13 Session-only activity log (last 200 tool/time/account/count/outcome entries), deletable and no payloads/errors/source/SQL.
- [x] F-6.14 Setup docs for Claude Code, Claude Desktop and Cline, with source-checkout instructions before npm publication.
- [x] F-6.15 Guidance alongside Oracle AI Connector Service, linked to official documentation.
- [x] NF-6.1–NF-6.3 stdio/Native Messaging + local-domain IPC without network ports; shared Zod/SELECT-WITH input guard; per-session rate/concurrency/output/deadline bounds.

### External release gates (not replaced by fixture tests)

- [ ] F-6.3 Deploy docs; inspect public privacy URL and update release/listing links.
- [ ] F-6.4 Submit listing/video and obtain Web Store approval; test public install.
- [ ] F-6.5 Supply the dedicated security email required by `docs/security-privacy.md`.
- [ ] F-6.7–F-6.8 Confirm services contact and active sponsorship destinations.
- [ ] F-6.9 Publish `netsuite-suitelens-mcp` to npm and test a fresh registry installation; promote the extension `1.0.0-rc.1` and MCP `1.0.0-beta.1` candidates only after live verification.
- [ ] F-6.9 Verify Chrome registration, connection and uninstall on macOS/Linux/Windows. Node/macOS fixture transport tests do not prove live Chrome or other OS integration.
- [ ] F-6.10–F-6.12 Verify the real sandbox schema through Claude Code after explicit extension approval, production denial, revoke/expiry and live role/File Cabinet coverage.
- [ ] Complete beta feedback and launch communication plan with maintainer-selected channels.

Evidence and handoff: `docs/launch/release-checklist.md`, `docs/validation/prd06-launch.md`,
`artifacts/launch/` (ignored local media/npm artifacts), `.site/` (ignored built docs).
Security exception approved explicitly for this task and recorded in ADR 0044.

## 6. Launch plan

- Soft launch to 10–20 beta testers (consultants) two weeks before release.
- Launch article (LinkedIn, blog, dev.to) and posts in NetSuite communities (Reddit r/Netsuite, the NetSuite Professionals Slack).
- A short live demo / webinar.
- Submit to curated lists of NetSuite tools and extensions.
