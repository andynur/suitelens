# 0052 — Two-level navigation, Home and AI drawer

Status: Accepted (2026-10-07)

Supersedes the flat tab order of ADR 0050. The priority+ tab row, the pinned Settings tab and
workspace roles stay.

## Context

Ten flat tabs mixed views of the record on the page (fields, automation, raw data) with
account-wide tools (SuiteQL, logs, Where used). Names such as "Record", "Inspector" and
"Console" did not say what the tab shows. AI and AI Context Export were one tab although
Context Export makes no AI call. A first-time user had no place that explains the tabs.

## Decision

- Two navigation levels (`src/entrypoints/sidepanel/GroupNav.tsx`, `TabBar.tsx`):
  - **Record**: Fields · Automation · Raw data · Related.
  - **Tools**: SuiteQL · Logs · Impact · RESTlets · Docs.
  - A Home button before the groups; Settings stays a pinned icon tab.
  - The tab row shows the selected group's tabs with priority+ overflow. Every feature is at
    most two clicks away.
- Renames: Record → **Fields**, Inspector → **Raw data**, Console → **SuiteQL**, Where used →
  **Impact** (user decision; short and matches the feature flag "Impact Analysis"). The tab
  content still says what the scan is: possible references with coverage, never a risk verdict.
  Row shortcuts read "Check impact of <id>".
- Related transactions move from Raw data to their own **Related** tab. Compare becomes a
  "Compare with…" action on Raw data and in the command bar.
- AI Assist becomes a header button (✦) that opens a drawer over any tab (moved to the group
  row as "AI Assistant" by ADR 0053); the tab underneath
  keeps its state. AI Context Export moves to **Docs** as the "AI agent context" preset next to
  "As-built document". Docs shows when either feature is on. The as-built preview renders its
  Markdown (text nodes only, never HTML; all-empty table columns hidden) and gains Copy Markdown
  and Download .md, the first copy/download format left open by ADR 0048. The content is the
  same value-free draft.
- Workspace roles order the tabs inside each group (`TAB_ORDER` in `src/shared/workspace.ts`).
- Context-aware landing: a page without a record opens **Home**; a record page opens the last
  Record tab used for that record type. The last tab is stored per account under
  `acct:<id>:tabs` (record type → tab name, at most 50 entries, cleared with account data).
- Home lists each group and tab with a one-line description, offers Go to record and the tour.
  A one-time tour (4 coach marks) starts after the welcome dialog and can be replayed from the
  ? menu.
- A record summary strip (`159 fields · 1 script · 1 workflow · 3 errors in loaded logs`) uses
  data the panel already has: the Fields read, the Automation Map cache and logs the Logs tab
  loaded. It adds no request of its own except the cached Automation Map read. The Automation
  tab shows the same count as a badge; Logs shows loaded errors.
- Logs gets a scope control on record pages: "Scripts on <record type>" (scripts from the
  Automation Map cache) or "All scripts". It defaults to the record type only when those scripts
  have loaded logs; a script handoff from Automation or RESTlets always shows all scripts.
- The command bar (⌘/Ctrl+K) includes Go to record and a "Search fields for …" command; the
  separate # button remains only when the command bar is turned off.

## Consequences

- E2E tests select tabs through `openTab`, which picks the group first (`tests/e2e/harness.ts`).
- Feature flags and Safe mode still hide tabs; a group without enabled tabs is hidden, and Safe
  mode hides Home.
- The logs error badge appears only after the Logs tab loaded logs in this panel session, so no
  log query runs just for a badge.
