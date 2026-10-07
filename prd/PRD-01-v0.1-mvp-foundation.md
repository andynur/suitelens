# PRD-01 — v0.1 MVP Foundation

| | |
| --- | --- |
| Status | Implemented locally; sandbox and installation acceptance pending |
| Target | Oct–Nov 2026 (4–6 weeks) |
| Tier | Community (free) |
| Depends on | — |

Progress reconciled on October 6, 2026. Checked items establish only the evidence described
below; sandbox and external acceptance remain separate. See the
[validation matrix](../docs/validation/prd01-06-matrix.md).

## 1. Goal

Build the technical foundation (adapter, bridge, context, side panel) and the four features developers
use most every day, so the extension is useful from its very first release.

**Expected outcome:** from any record page, in ≤ 2 clicks, the user knows every field (with IDs) and every
automation that runs on that record type.

## 2. User stories

| ID | As a | I want to | So that |
| --- | --- | --- | --- |
| US-1.1 | Developer | see every field of the open record with its internal ID, type and value | I don't have to open the Records Browser |
| US-1.2 | Developer | search fields by label or ID | I find fields fast on long records |
| US-1.3 | Admin | show field IDs next to labels on the form | I can map fields while talking to users |
| US-1.4 | Developer | see all User Event, Client and Workflow Action scripts and workflows for this record type | I know what runs when the record is saved |
| US-1.5 | Consultant | see deployment status and execution context | I can diagnose why a script isn't running |
| US-1.6 | Anyone | visually tell production from sandbox | I never work in the wrong environment |
| US-1.7 | Developer | open a record by internal ID and type | I navigate fast while debugging |
| US-1.8 | Anyone | switch off features I don't need | the extension stays lightweight |

## 3. Functional requirements

### 3.1 Foundation
- F-1.1 `NetSuiteAdapter` + `LiveAdapter` + `FixtureAdapter` (see `docs/architecture.md`).
- F-1.2 MAIN-world bridge with a per-tab nonce and an operation allow-list: `getRecordType`, `getCurrentRecordFields`, `runSuiteQL` (internal, for the Automation Map).
- F-1.3 `PageContext` detection (account, environment, page kind, record type, record ID), updated on navigation.
- F-1.4 Side panel with **Record**, **Automation** and **Settings** tabs; the header shows account + environment + record.
- F-1.5 Clear states for "not on a NetSuite page" and "this page is not a record".

### 3.2 Field Explorer (Record tab)
- F-1.6 Body field table: label, field ID, type, value (as text), mandatory, standard/custom, disabled/hidden when known.
- F-1.7 Sublist fields grouped by sublist (sublist ID + column fields); line values are optional in v0.1.
- F-1.8 Search (label/ID) and filters: custom only, mandatory only, non-empty only.
- F-1.9 Copy field ID on click; copy as `fieldId` / `'fieldId'` / snippet `rec.getValue({ fieldId: '…' })`.
- F-1.10 Data sources: record XML (`&xml=T`) for metadata + `N/currentRecord` for values in edit mode; show which source was used.

### 3.3 Show Field IDs on page
- F-1.11 Toggle that adds a small badge with the field ID next to form labels; must not noticeably change the layout; can be switched off; off by default.

### 3.4 Automation Map (Automation tab)
- F-1.12 Scripts deployed to the record type: script type, name, script ID, deployment ID, status, log level, execution context (when available), script file.
- F-1.13 Workflows for the record type: name, status (released / testing / not running), trigger (when available).
- F-1.14 Display order: Client → User Event (beforeLoad, beforeSubmit, afterSubmit) → Workflow; label the order "approximate" when data is incomplete.
- F-1.15 Direct links to the script record, deployment record and the file in the File Cabinet.
- F-1.16 Cache per account + record type (24 h TTL) with a refresh button.
- F-1.17 All queries in `src/netsuite/queries/automation.ts` with `VERIFY` tags.

### 3.5 Environment Guard
- F-1.18 Thin colored banner at the top of the page showing account name + environment.
- F-1.19 Favicon tint per environment.
- F-1.20 Default colors: production red, sandbox amber, release preview purple; configurable per account; custom label per account (e.g. "ACME – PROD").

### 3.6 Quick Go-to
- F-1.21 Record type + internal ID input, open in the same or a new tab; last 10 per account.
- F-1.22 Keyboard shortcuts to open the side panel and Quick Go-to (changeable at `chrome://extensions/shortcuts`).

### 3.7 Settings
- F-1.23 Theme (system/light/dark), per-feature toggles, environment colors.
- F-1.24 "Clear cache for this account" and "Delete all data".
- F-1.25 About page: version, repo link, privacy policy, trademark disclaimer.

## 4. Non-functional requirements

| Code | Requirement |
| --- | --- |
| NF-1.1 | Side panel renders < 300 ms after opening; Field Explorer fills < 1.5 s for records with ≤ 300 fields (no cache) |
| NF-1.2 | Content script adds < 50 ms to page load |
| NF-1.3 | No network requests other than same-origin NetSuite calls |
| NF-1.4 | Total bundle < 2 MB |
| NF-1.5 | Accessibility: full keyboard navigation in the side panel, WCAG AA contrast |
| NF-1.6 | All UI strings go through `t()`; English at launch, ready for more locales |

## 5. Acceptance criteria

Status reconciled on 2026-10-06. "Fixture" = verified with `FixtureAdapter` and
`fixtures/pages`; items needing a real account stay open until checked in a sandbox.

- [ ] On a Sales Order page (fixture and real account), Field Explorer shows body fields and the `item` sublist. — fixture ✅ (unit + E2E), real account pending
- [x] Searching "memo" finds the `memo` field in < 100 ms. — unit test on 300 fields + E2E
- [x] Clicking a field ID copies it to the clipboard and shows a toast. — unit + E2E
- [ ] Show Field IDs places a badge on ≥ 90% of field labels on standard forms. — fixture form 100%; real standard forms pending (`VERIFY` label DOM)
- [ ] Automation Map shows at least the UE and CS scripts deployed to the record type (verified on a real account). — fixture ✅, real account pending (`VERIFY` SuiteQL)
- [x] When the automation query fails, the UI explains likely causes (permission, table unavailable) without crashing. — unit tests
- [x] The Environment Guard banner appears on sandbox in the configured color. — E2E
- [x] Cached data from account A never appears while viewing account B. — unit tests (cache + loader)
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is green in CI. — [CI run 37244542997](https://github.com/andynur/suitelens/actions/runs/37244542997) passed on October 5, 2026 (Asia/Jakarta), commit `e1d955a`; the test step ran `pnpm test:coverage`. This is historical CI evidence, not CI proof for later PRD-05/06 changes.
- [ ] The extension loads unpacked with no unnecessary permission warnings. — manifest reviewed (ADR 0003); manual load check pending

### Implementation checklist

- [x] F-1.1 – F-1.5 Foundation (adapter, bridge, context, side panel, empty states)
- [x] F-1.6 – F-1.10 Field Explorer
- [x] F-1.11 Show field IDs on page
- [x] F-1.12 – F-1.17 Automation Map (queries tagged `VERIFY`)
- [x] F-1.18 – F-1.20 Environment Guard
- [x] F-1.21 – F-1.22 Quick Go-to and keyboard shortcuts
- [x] F-1.23 – F-1.25 Settings and About

## 6. Out of scope for v0.1

User-facing SuiteQL console, record XML viewer, RESTlet tester, log viewer, AI, any write operation,
environment comparison, licensing/payments.

## 7. Metrics

- Activation: % of installs that open the Record tab within 7 days.
- Most-opened features (opt-in telemetry, event names only).
- Automation query errors per 100 sessions (to fix VERIFY queries).

## 8. Technical notes & risks

- `N/currentRecord` is only relevant on form pages; in view mode rely on record XML.
- The URL → record type mapping table will keep growing; make it easy to extend through community PRs.
- Some roles cannot access script/deployment tables; show "your role lacks permission X" when detected.
