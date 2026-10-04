# MASTER PROMPT — SuiteLens for NetSuite (Chrome Extension)

> Paste everything below the line into your coding agent (Claude Code, Codex, Cline, etc.)
> from the root of an empty repository that already contains `CLAUDE.md`, `docs/` and `prd/`.
> Display name: "SuiteLens for NetSuite". Technical slug for the repo and packages: `netsuite-suitelens`.

---

## Role

You are a senior Chrome extension engineer **and** a senior NetSuite technical consultant
(SuiteScript 2.1, SuiteQL, SuiteCloud/SDF, REST/RESTlets, the NetSuite UI and its quirks).
You write production-grade TypeScript, care deeply about security and privacy, and keep
the codebase small, typed and testable.

## Mission

Build **SuiteLens for NetSuite** (repo and package slug: `netsuite-suitelens`): a free, open-source, context-aware developer workbench for
NetSuite developers, admins and consultants, delivered as a Manifest V3 Chrome extension.

It combines and goes beyond the ideas of existing tools (field explorers, scripted-record
viewers, SuiteQL consoles) by focusing on **change & context**:
understanding what a record is connected to, what will break when something changes,
and giving AI tools correct, account-specific context.

Read these files **before writing any code**, in this order:

1. `CLAUDE.md` — repository rules (mandatory)
2. `prd/PRD-00-overview.md` — vision, personas, principles
3. `docs/architecture.md` — architecture and design decisions
4. `docs/security-privacy.md` — non-negotiable security rules
5. `prd/PRD-01-v0.1-mvp-foundation.md` — the scope of THIS task

Your task in this session is **only v0.1 (MVP Foundation)**. Later versions have their own PRDs;
do not implement them now, but design interfaces so they can be added without rewrites.

## Tech stack (use exactly this unless you find a blocking reason — if so, stop and explain)

- **Framework:** WXT (Vite-based web extension framework), Manifest V3, Chrome first
  (keep Edge/Firefox compatibility in mind; do not use Chrome-only APIs without a guard).
- **Language:** TypeScript, `strict: true`, no `any` without a comment explaining why.
- **UI:** React 18+ in the **side panel** (`chrome.sidePanel`), Tailwind CSS, a small set of
  accessible headless primitives (e.g. Radix UI). Light and dark theme from day one.
- **Editor (for later versions):** CodeMirror 6 (not Monaco — bundle size).
- **State:** Zustand (UI state) + typed message bus between contexts.
- **Storage:** `chrome.storage.local` for settings; IndexedDB (via `idb` or Dexie) for metadata
  cache, **namespaced per NetSuite account ID**.
- **Validation:** Zod for every message crossing a context boundary and every external payload.
- **Testing:** Vitest (unit), Playwright (E2E against local HTML fixtures), Testing Library (UI).
- **Quality:** ESLint (typescript-eslint), Prettier, `tsc --noEmit` in CI.
- **CI:** GitHub Actions: lint, typecheck, test, build, upload zipped extension as artifact.
- **Package manager:** pnpm.

## Architecture you must implement (summary — full detail in docs/architecture.md)

```
┌────────────── NetSuite tab (https://<account>.app.netsuite.com) ──────────────┐
│  MAIN world bridge script  ◄── window.postMessage (nonce-checked) ──►  Content │
│  (uses NetSuite's own AMD `require` → N/query, N/currentRecord,         script │
│   runs with the USER'S session and permissions)                         (ISOLATED)│
└──────────────────────────────────────────────────────────────────┬────────────┘
                                                                   │ chrome.runtime messaging (Zod-typed)
                                     ┌─────────────────────────────▼──────────┐
                                     │ Background service worker               │
                                     │ - message router, cache (IndexedDB)     │
                                     │ - settings, per-account namespaces      │
                                     └─────────────────────────────┬──────────┘
                                                                   │
                                     ┌─────────────────────────────▼──────────┐
                                     │ Side panel (React)                      │
                                     │ - tabs: Record · Automation · Settings  │
                                     └─────────────────────────────────────────┘
```

Key rules:

1. **NetSuite Adapter pattern.** All access to NetSuite goes through one interface,
   `NetSuiteAdapter`, with two implementations:
   - `LiveAdapter` — talks to the page via the bridge (production).
   - `FixtureAdapter` — reads JSON/XML fixtures from `fixtures/` (development and tests).
   The UI never knows which one it is using. Switching is a dev setting / env flag.
   This lets 70–80% of development happen **without a NetSuite account**.
2. **Session-based access.** v0.1 uses only the logged-in user's session. No OAuth, no TBA,
   no stored credentials, ever.
3. **Bridge script** is a WXT *unlisted script* injected into the MAIN world. It:
   - only answers messages carrying a per-tab random nonce created by the content script,
   - exposes a fixed allow-list of operations (no `eval`, no arbitrary code execution),
   - wraps NetSuite's AMD loader: `require(['N/query'], (query) => ...)`, with a timeout and a
     clear error when `require` or a module is unavailable on the current page.
4. **Context detection** (content script): account ID, environment (production / sandbox /
   release preview), page type (record view/edit/create, list, search, other), record type,
   record internal ID. Derive from URL + DOM + `nlapiGetRecordType`-style globals only as
   fallback; prefer URL parsing. Publish a typed `PageContext` object.
5. **Record XML.** For field metadata, fetch the record with `&xml=T` (same-origin, user's
   session) from the content script, parse with `DOMParser`, never inject the result as HTML.
6. **SuiteQL** for automation lookups (scripts, deployments, workflows per record type).
   IMPORTANT: table and column names in SuiteQL vary and are not always documented.
   **Do not guess silently.** Put every SuiteQL statement in `src/netsuite/queries/*.ts` with a
   comment `// VERIFY in Records Catalog / account` and add a fixture for its expected shape.
   If a column is uncertain, write the query defensively and surface a friendly error.
7. **Per-account isolation.** Every cached item key starts with the account ID.
   Sandbox and production data must never mix.
8. **Read-only by default.** v0.1 performs no writes to NetSuite.

## Manifest constraints

- `permissions`: `sidePanel`, `storage`, `scripting`, `activeTab` (add others only with a written reason in the PR).
- `host_permissions`: only NetSuite domains needed, e.g. `https://*.app.netsuite.com/*`.
  Do not request `<all_urls>`.
- No remote code. No CDN scripts. Everything bundled.
- A strict extension-pages CSP.

## v0.1 deliverables (see PRD-01 for acceptance criteria)

1. Repository scaffold with WXT + React + Tailwind + TypeScript strict, ESLint, Prettier, Vitest,
   Playwright, GitHub Actions CI.
2. `NetSuiteAdapter` interface + `LiveAdapter` + `FixtureAdapter` + realistic fixtures
   (sales order, customer, custom record) with **fake data only**.
3. Context detection + `PageContext`.
4. Side panel with three tabs:
   - **Record** — Field Explorer (searchable table: label, field ID, type, value, mandatory,
     custom vs standard, sublist fields grouped), copy-to-clipboard, "show field IDs on page" toggle.
   - **Automation** — Automation Map for the current record type: User Event, Client,
     Workflow Action scripts and workflows, with deployment status, execution context and
     links to the script/deployment record. Ordered by expected execution order where known.
   - **Settings** — theme, environment colors, feature toggles, adapter mode (dev only),
     "clear cache for this account".
5. **Environment Guard** — colored banner + favicon tint per account, configurable.
6. **Quick Go-to** — open record by internal ID + record type.
7. Unit tests for parsers, context detection and adapters; one Playwright E2E per tab using fixtures.
8. `README.md` for the repo (install from source, dev workflow, privacy summary, disclaimer).
9. `docs/decisions/0001-*.md` ADRs for any decision that deviates from or extends these docs.

## Working method

1. First, produce a short **plan** (files to create, order of work, open questions). Wait for my
   confirmation only if something in the PRD is contradictory; otherwise proceed.
2. Work in small, reviewable commits (Conventional Commits: `feat:`, `fix:`, `chore:` …).
3. After each milestone: run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` and fix failures
   before moving on.
4. When something about NetSuite behaviour is uncertain, **say so**, add a `VERIFY` note, and
   build a safe fallback. Never invent NetSuite APIs, tables or URL parameters.
5. Keep `docs/` and the PRD checklists updated as you finish items.
6. At the end, give me: what was built, how to load it unpacked in Chrome, what needs to be
   verified in a real NetSuite account, and known gaps.

## Definition of done for this session

- `pnpm build` produces a loadable MV3 extension; `pnpm dev` runs with hot reload.
- With `FixtureAdapter`, every v0.1 feature works on the local fixture pages.
- CI is green. No `TODO` without an issue reference or `VERIFY` tag.
- No network calls except same-origin NetSuite requests made with the user's session.
