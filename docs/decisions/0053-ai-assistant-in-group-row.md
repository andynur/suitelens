# 0053 — AI Assistant in the group row, AI setup in the drawer

Status: Accepted (2026-10-07)

Amends ADR 0052 (AI drawer entry point). The drawer itself does not change.

## Context

ADR 0052 put AI behind an unlabelled ✦ icon in the header, between the command bar and help.
Users missed it, and the group row (Home · Record | Tools) left most of its width empty. AI
entry points in current tools are labelled and get their own color, so people find them
without a tour.

## Decision

- A labelled **AI Assistant** button (sparkle icon + text) sits at the end of the group row
  (`src/entrypoints/sidepanel/GroupNav.tsx`). The header icon is removed, so there is one entry
  point; the command bar ("Open AI Assistant") and the Home card stay.
- It is a toggle button (`aria-expanded`), not a third group. A group switches the tab row;
  AI opens a drawer over the current tab and keeps that tab's state. Putting it inside the
  Record | Tools control would mix two behaviours in one control.
- Color: ADS discovery tokens (`text-discovery`, `bg-discovery-bg`, `bg-discovery-bg-hovered`;
  both themes ≥ 5:1 contrast). DESIGN.md reserves them for AI entry points, so the color keeps
  its meaning.
- The drawer covers only the area below the group row (it is rendered inside that container),
  so the toggle stays visible and closes it again. Choosing Home or a group closes the drawer.
- AI setup (provider, key, model, token limits) moves from Settings into the drawer as a
  collapsible "AI setup" section: open while no key is ready, closed with a one-line status
  ("Google Gemini · model") once it is. Settings keeps a short AI section with "Open AI setup",
  so there is one form, next to where it is used. "Open AI setup" notices elsewhere (Logs,
  SuiteQL) open the drawer at that section.
- Settings sections are collapsible (native details/summary). Appearance, Workspace, AI and
  This account open by default; long or rarely used sections start closed and show a status
  (for example "14 of 15 on"). Open state is remembered per browser in localStorage.
- "AI Assistant" is title case because it is the name of a feature, like a product name; other
  UI copy stays sentence case.

## Consequences

- No change to what AI sends or when: the preview and BYOK rules of ADR 0041 still apply.
- Turning AI Assist off in Settings removes the button, as before.
- Tour text moves the AI hint from the commands step to the groups step.
- E2E tests open Settings through `openSettings()`, which expands every section.
