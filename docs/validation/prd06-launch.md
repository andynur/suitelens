# PRD-06 local validation — October 6, 2026

The extension is a **1.0.0-rc.1 candidate** (Chrome numeric version 1.0.0); the separately packaged
bridge is **1.0.0-beta.1**. These are local artifacts, not published/approved releases. The worktree
includes the pre-existing F-6.1 hardening changes plus the completed continuation; nothing was pushed.

## Evidence

| Check | Result | What it establishes |
| --- | --- | --- |
| `pnpm verify` | Passed: 108 unit files, 817 tests, MCP package tests, docs build, production build | Source lint/types, fixture/unit behavior, compilation and package transport contracts |
| MCP package tests | 5 passed | Strict read-only tools, split/bounded native frames, temporary-home installer/uninstaller, real SDK stdio + native process + local IPC round trip, late-reply isolation after reconnect |
| Full `pnpm test:e2e` | 73 passed; 1 media task intentionally skipped | Fixture browser workflows across the workbench, light/dark, account isolation, deletion, hardening, onboarding and static docs |
| Subsequent focused UI check | 6 passed (Settings, onboarding, docs) | Final candidate/privacy copy, startup readiness and explicit MCP revocation actions after later source refinements |
| Startup/deletion regression check | 10 passed across two repetitions | Tour reset after deletion, replay readiness and keyboard palette gestures after initial context settles |
| `pnpm launch:assets` / focused media task | Passed | Five 1280×800 fixture screenshots and a recorded browser walkthrough; final WebM is 75 seconds at 1280×800 |
| Packed npm artifact smoke | Passed in a clean temporary home | npm installation of the local tarball, executable CLI, exact-origin manifest registration and uninstall; no real user's registration changed |
| `pnpm docs:build` | 12 pages; relative links verified | Standalone static output, no JavaScript/trackers/CDN; desktop/mobile screenshots inspected with no horizontal page overflow |
| `pnpm audit --prod --audit-level high` | No known vulnerabilities found | Current production dependency audit; not a general security guarantee |
| `git diff --check` | Passed | Patch whitespace check |

The full E2E pass preceded the final source-ID/folder resolver, crash-log privacy and preference-
revocation refinements. Those are covered by the final full unit/type/build gate and the focused
UI check above. Browser fixtures do not run arbitrary real N/query/catalog/File Cabinet behavior.

The initial E2E run exposed two existing deletion expectations that did not dismiss reset onboarding,
and a startup race that remounted a just-opened tour/palette. The deletion checks now verify the reset
tour; replay waits for context readiness, and the harness waits for tour closure plus settled header
context. The final full suite and repeated focused checks passed.

Crash messages and stacks remain collapsed in local UI only; SuiteLens and React caught-error logging
never emit them. Safe mode, bridge disable and production opt-out explicitly revoke the native
connection independently of whether the settings write succeeds. Grants are not restored after worker
restart. Every adapter read checks the grant and pinned account/page before and after execution.
Native-host reconnects discard replies belonging to the previous client. Oversized MCP requests
fail before reserving pending-request slots, so repeated rejected inputs do not exhaust the bridge.

## Artifacts

- `.site/index.html`: built static docs preview, with privacy/security/setup pages.
- `artifacts/launch/netsuite-suitelens-1.0.0-chrome.zip`: production candidate; no fixture adapter chunks in the production build output listing.
- `artifacts/launch/netsuite-suitelens-mcp-1.0.0-beta.1.tgz`: publishable local npm package candidate.
- `artifacts/launch/01-record.png` through `05-mcp-privacy.png`: fabricated fixture screenshots.
- `artifacts/launch/demo-75s.webm`: silent recorded fixture walkthrough; no claimed live MCP/NetSuite demo.
- `artifacts/launch/docs-desktop.png` and `docs-mobile.png`: static docs layout review.

Artifacts and `.site/` are ignored local outputs. Run the documented build/media commands to reproduce
them. The optional GitHub Pages workflow is manual and has not been run.

## GitHub state verified

`andynur/suitelens` is public; `good first issue` already exists. Private vulnerability reporting was
disabled, then enabled and rechecked in this task. GitHub Pages was not enabled. No issue/comment,
launch announcement, sponsorship action, repository push or public package publication was performed.

## Required external proof and inputs

- Real sandbox schema from Claude Code after the user's extension approval, plus role/source limits.
- Live production-default denial and revoke/expiry behavior.
- Live Chrome native registration and uninstall on each advertised OS (Windows launcher/registry/ACL
  and Linux Chrome integration are unverified; macOS Node transport tests are not Chrome proof).
- Dedicated security email, services contact and verified active sponsor URLs.
- Selected docs host/public privacy URL, npm publication and a fresh registry installation.
- Chrome Web Store submission, approval, demo upload and public installation.
- Beta feedback and explicitly authorized launch communications.

See [release checklist](../launch/release-checklist.md). PRD acceptance for public launch remains open
until these external gates actually pass; local/fixture evidence is not substituted for them.
