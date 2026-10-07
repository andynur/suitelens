# CLAUDE.md — Repository rules for coding agents

These rules apply to every change in this repository. `AGENTS.md` is a symlink to this file
(read by Codex/Cline).

## Product

SuiteLens for NetSuite — a free, open-source MV3 Chrome extension that gives NetSuite developers,
admins and consultants context about records, automations, data and change impact.
Source of truth for scope: `prd/`. Source of truth for architecture: `docs/architecture.md`.
Source of truth for UI (Atlassian Design System tokens, primitives, patterns): `DESIGN.md`.

## Context budget

- Scope = the one PRD named in the task (default: the version after `package.json` `version`).
  Read `prd/PRD-00-overview.md` only for vision questions; do not read other version PRDs.
- Read `docs/security-privacy.md` before touching bridge, adapter, storage, AI or writes.
  Read `docs/architecture.md` / an ADR in `docs/decisions/` only for the area you change.
- Never read generated or bulky files: `pnpm-lock.yaml`, `.output/`, `.wxt/`, `coverage/`,
  `test-results/`, `playwright-report/`, `node_modules/` (except a package's `.d.ts` when needed).
- Find code with grep/glob on the layout below before opening whole files.
- Iterate with one test file: `pnpm vitest run <path>`. Run the full gate once at the end.

## Non-negotiables

1. **Security first.** Follow `docs/security-privacy.md`. If a request conflicts with it, stop and ask.
2. **No remote code.** Never load or `eval` code from the network. No CDN scripts.
3. **No credential storage.** Never store NetSuite passwords, session cookies or tokens.
   AI API keys (BYOK) only via the dedicated secure-storage module.
4. **Read-only by default.** Any write to NetSuite needs: an explicit user action, a confirmation
   dialog naming the record and environment, and is blocked on production unless the user
   enabled "allow writes in production" for that account.
5. **Per-account isolation.** All cached data is keyed by NetSuite account ID.
6. **Data stays local.** Nothing leaves the browser except (a) same-origin NetSuite calls with the
   user's session and (b) AI calls the user explicitly triggered with their own key, after a
   preview of what will be sent, and (c) explicitly approved local read-only MCP access over
   stdio/Native Messaging (ADR 0044), scoped to one session and account for at most one hour.
7. **Never invent NetSuite APIs.** Unknown table/column/URL behaviour → `// VERIFY:` comment,
   defensive code, fixture, and a user-friendly error path.
8. **All NetSuite access goes through `NetSuiteAdapter`.** UI code must not call `fetch`
   against NetSuite or touch the bridge directly.

## Code conventions

- TypeScript strict. Prefer `type` over `interface` unless extending. No default exports except
  WXT entrypoints and React page components.
- Folder layout:
  ```
  src/
    entrypoints/        # WXT: background.ts, content.ts, sidepanel/, bridge (unlisted, MAIN world)
    netsuite/
      adapter/          # NetSuiteAdapter, LiveAdapter, FixtureAdapter
      bridge/           # message protocol (Zod schemas), nonce handling
      context/          # PageContext detection
      queries/          # every SuiteQL statement lives here, one file per domain
      parsers/          # record XML, URL, HTML parsing
    features/           # one folder per feature (field-explorer, automation-map, ...)
    shared/             # ui primitives, hooks, storage, logger, i18n
    test/               # shared unit-test helpers (fake window, adapters, fixture loaders)
  fixtures/             # fake NetSuite responses & page snapshots (no real data)
  tests/                # e2e (Playwright)
  docs/ prd/
  ```
- Every cross-context message has a Zod schema in `src/netsuite/bridge/protocol.ts`.
- Feature flags in `src/shared/features.ts`; every feature can be turned off in Settings.
- i18n-ready strings via a tiny `t()` helper (English only at launch; more locales later through community translations); no hardcoded UI copy in components.
- Logging via `src/shared/logger.ts`; never log record values or query results at info level.

## Testing

- Unit tests next to code (`*.test.ts`). Parsers and context detection need ≥ 90% coverage.
- Every SuiteQL query has a fixture and a test for its result mapper.
- E2E tests run against `fixtures/pages/*.html` with `FixtureAdapter`; never against a real account in CI.

## Workflow

- Conventional Commits. Small PRs. Update the PRD checklist when an item is done.
- Before finishing any task: `pnpm verify` (lint, typecheck, test, build). UI change: also `pnpm test:e2e`.
- Record significant decisions as ADRs in `docs/decisions/NNNN-title.md`.

## Legal

- Product name pattern: "<Name> for NetSuite". Include the Oracle trademark disclaimer in README,
  store listing and About screen.
- Do not copy code, UI text or assets from other extensions. Inspiration is fine; credit it in README.
