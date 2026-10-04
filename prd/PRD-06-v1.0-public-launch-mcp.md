# PRD-06 — v1.0 Public Launch & Local MCP Bridge

| | |
| --- | --- |
| Status | Draft |
| Target | March 2027 (3–4 weeks) |
| Tier | Community |
| Depends on | v0.1–v0.5 |

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
Coding agent (MCP client) ──stdio──► netsuite-loupe-mcp (Node, MCP SDK)
                                         │ Native Messaging
                                         ▼
                                  Extension background ──► content/bridge ──► NetSuite (user session)
```

### Requirements
- F-6.9 Package `packages/mcp-bridge`, published to npm as `netsuite-loupe-mcp`, installable with a single command; the installer writes the Chrome Native Messaging manifest for the user's OS.
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
- [ ] Without approval, every tool returns a clear "not authorized" error.
- [ ] `run_suiteql` with `DELETE`/`UPDATE` is rejected.

## 6. Launch plan

- Soft launch to 10–20 beta testers (consultants) two weeks before release.
- Launch article (LinkedIn, blog, dev.to) and posts in NetSuite communities (Reddit r/Netsuite, the NetSuite Professionals Slack).
- A short live demo / webinar.
- Submit to curated lists of NetSuite tools and extensions.
