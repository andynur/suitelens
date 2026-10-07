# Contributing to SuiteLens for NetSuite

Thanks for taking the time to contribute. This is a small, security-conscious extension, so a
few things are stricter here than in a typical repo.

## Before you start

- Read [CLAUDE.md](CLAUDE.md) (repo rules: security, folder layout, conventions). It applies to
  every change, human or AI-assisted.
- Read [docs/architecture.md](docs/architecture.md) and [docs/security-privacy.md](docs/security-privacy.md).
- For anything beyond a small fix, open an issue first to agree on the approach before writing code.

## Setup

```bash
pnpm install
pnpm dev:fixtures   # side panel runs against FixtureAdapter, no NetSuite account needed
```

Requirements: Node.js 22.22 or later (CI uses the version in `.nvmrc`), pnpm 10.

## Making a change

- Keep PRs small and focused on one thing.
- Follow the existing folder layout (`src/netsuite/`, `src/features/`, `src/shared/`) — see
  CLAUDE.md for the full layout and where new code belongs.
- All NetSuite access goes through `NetSuiteAdapter`; UI code must not call `fetch` against
  NetSuite or touch the bridge directly.
- Add or update unit tests next to the code you change (`*.test.ts`). Parsers and context
  detection need ≥ 90% coverage. Every SuiteQL query needs a fixture and a mapper test.
- New cross-context messages need a Zod schema in `src/netsuite/bridge/protocol.ts`.
- New user-facing strings go through the `t()` helper in `src/shared/i18n/`, not hardcoded.
- New features should be gated behind a flag in `src/shared/features.ts` so they can be turned
  off in Settings.

## Before opening a PR

Run the full check suite locally:

```bash
pnpm verify   # lint, typecheck, unit + MCP tests, docs build, production build
```

For UI changes, also run `pnpm test:e2e` and verify the feature manually in Chrome
(`chrome://extensions` → Load unpacked → `.output/chrome-mv3`).

## Commit messages and PR titles

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
`refactor:`, `test:`, `chore:`). Reference the related issue if there is one.

## Security-sensitive changes

Any change that touches the bridge, the adapter, storage, permissions or writes to NetSuite is
security-sensitive. Re-read [docs/security-privacy.md](docs/security-privacy.md) first. If a
change would conflict with one of the non-negotiables in CLAUDE.md, open an issue to discuss
before writing code — don't work around it silently.

Found a security vulnerability? Do not open a public issue — see [SECURITY.md](SECURITY.md).

## Significant decisions

Non-trivial architectural choices are recorded as ADRs in `docs/decisions/NNNN-title.md`. Add
one if your PR changes an existing decision or makes a new one worth remembering.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to
uphold it.

## First contributions

Look for `good first issue` tasks with a bounded scope and fixture-based acceptance criteria.
Maintainers define these through the scoped issue template; `.github/labels.json` contains the
label definitions to synchronize with GitHub. Do not post client data in issues.

The local MCP package lives in `packages/mcp-bridge`; `pnpm test:mcp` builds and tests its actual
stdio/native/IPC transports in temporary homes. Documentation sources live in `docs/launch`;
`pnpm docs:build` creates the standalone static site. All npm/website/store publication requires
review of the concrete artifacts and configured destinations.
