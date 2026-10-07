# 0050 — Priority+ panel navigation and workspace roles

Status: Accepted (2026-10-06); tab order superseded by ADR 0052

## Context

The side panel grew to ten tabs (Record, Automation, Console, Inspector, RESTlets, Where used,
Logs, AI, Docs, Settings). At a real side-panel width (360–480px) a wrapping tab list took two
rows, and a scrolling one hid Where used, AI and Settings off-screen. Functional consultants,
administrators and developers use different subsets of the panel, so a single fixed order
serves none of them well.

## Decision

- The tab row uses the priority+ pattern (`src/entrypoints/sidepanel/TabBar.tsx`). Tabs that fit
  the measured width stay in the row in order; the rest move to a **More** menu with a one-line
  description per entry. The selected tab is always promoted into the row, so it stays visible
  and keeps `role="tab"` with `data-state="active"`.
- Settings becomes a pinned icon tab at the right edge (accessible name "Settings").
- A new global setting `workspaceRole` (`developer` default, `admin`, `consultant`) orders the
  feature tabs (`src/shared/workspace.ts`). It is chosen on the first onboarding step or in
  Settings → Workspace. It never disables a feature; feature flags and Safe mode still decide
  what exists.
- Without layout (unit tests in jsdom) every tab is shown, so component tests stay
  deterministic. E2E tests select tabs through the `openTab` and `navigationNames` helpers in
  `tests/e2e/harness.ts`.

## Consequences

- No horizontal scrolling or second tab row; every feature is one or two clicks away.
- A tab can move between the row and the More menu when the panel is resized.
- The setting is stored with the other global settings (no account data, no new permission).
