# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versions follow SemVer.

## [Unreleased]

First public release candidate (`1.0.0-rc.1`).

### Added

**Record**

- Side panel with Record and Tools tab groups, a Home page and a header showing account,
  environment and record.
- Field Explorer: body and sublist fields with label, ID, type, value and flags; search, filters
  and copy formats. Optional field-ID badges on the NetSuite form (off by default).
- Automation Map: client, user event and workflow action scripts and workflows per record type,
  cached per account for 24 hours.
- Record Inspector: XML/JSON view with search, folding and masked export; same-type record
  compare; bounded related-transaction tree.

**Tools**

- SuiteQL Console: editor tabs, formatting, run selection, bound parameters, paging and
  cancellation. Sortable results, CSV/JSON/Markdown export, per-account history, portable
  snippets and local autocomplete from a partial metadata index.
- Execution Log Viewer: filters, error grouping, JSON detail, CSV export and optional refresh.
- Impact (where used): scans script files, PDF templates and saved searches for possible
  references, with progress, cancel/resume and a coverage report of what was not checked.
- RESTlet Tester: discovery, request builder, same-origin execution with the browser session,
  local collections and production write guards.
- Docs: metadata-only Context Export (Markdown/JSON) for coding agents, and an opt-in as-built
  preview for one record type.

**General**

- Environment Guard: banner and favicon tint, with per-account label, color and environment.
- Quick Go-to with per-account history, and a Cmd/Ctrl+K command palette.
- AI Assist (bring your own key): Anthropic, OpenAI, Google Gemini, Groq, DeepSeek, Alibaba Qwen,
  Moonshot, Zhipu GLM, MiniMax, OpenRouter and Command Code. Editable, redactable preview before
  anything is sent; keys kept in session storage or encrypted with a passphrase; daily token
  limits. Explains scripts and log errors, and drafts SuiteQL that is validated but never run
  automatically.
- Local MCP bridge (`packages/mcp-bridge`): read-only tools for a coding agent on the same
  machine through Native Messaging, with one-hour per-account approval, production off by
  default, revocation and a metadata-only activity log.
- Onboarding tour, Safe mode, error recovery per tab, light/dark themes and opt-in local feature
  counters that never leave the device.
- Settings to turn off any feature, clear an account's cache or delete all local data.
- Static documentation site (`pnpm docs:build`), privacy policy, contribution and issue templates.

### Fixed

- Session token fields such as `_csrf` and `_eml_nkey_` are never read, shown or copied.
- Workflows load correctly: the `workflow` table uses `internalid`, and multi-record workflows
  match through `recordtypes`.
- Execution log queries use catalog-confirmed ScriptNote columns.
- Field ID badges keep the correct case inside uppercase NetSuite labels.
- Address values show line breaks instead of a literal `<br>`.

### Known limitations

- The Chrome Web Store listing, hosted documentation and the npm package for the MCP bridge are
  not published yet.
- AI providers have not all been validated with real keys.
- Impact does not yet read workflows, custom forms or field sourcing, and never proves that
  something is unused.
- Live behavior depends on the account and role; items marked `VERIFY` in the code still need
  checking in more sandbox accounts.
