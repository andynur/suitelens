# Side panel UX improvement plan

Status: Implemented (2026-10-07) in phases 0–4. Decisions recorded in ADR 0051 (Where used)
and ADR 0052 (navigation, Home, AI drawer). Builds on ADR 0050 (priority+ tabs, workspace roles).
Source: UX review of every panel tab on a real sandbox (invoice, purchase order) at a
~600px panel width.

## Goals

1. **Results before configuration.** The first screen of every tab shows the answer, not a form.
2. **One mental model.** Users can tell which tabs are about *this record* and which are
   *account tools* without reading documentation.
3. **Less reading.** Caveats stay honest (security-privacy and "possible reference" wording
   remain), but they are shown once, in context, not repeated as paragraphs.
4. **Connected features.** From any field, script or log, the related view is one click away.

Measurable checks (enforced with Playwright at a 400×720 viewport):

- Where used: first result row visible without scrolling after a scan.
- Logs: first log row visible without scrolling, even with all notices active.
- No tab shows more than one notice banner above its main content.
- Every icon-only button has a visible tooltip and an accessible name.

## Cross-cutting findings

| # | Finding | Fix |
|---|---|---|
| C1 | Grammar: "1 files", "1 occurrences", "1 scripts, 1 workflows". `t()` has no plural support. | Add ICU-style plural to `t()` (`{count, plural, one {# file} other {# files}}`) and migrate count strings. |
| C2 | Notice banners overused: Logs stacks 3, AI repeats "AI is not set up" twice, Where used has 1 warning + 6 helper paragraphs. | Banner only for actionable or warning states, max one per tab, dismissible (remembered per account). Explanations move to an ⓘ popover next to the related control. |
| C3 | Filter toggles ("Deployed only", "Custom", "Mandatory", "Group similar errors") look like secondary buttons; on/off state is unclear. | One `ToggleChip` primitive: pill shape, check icon and selected color when on, `aria-pressed`. Buttons keep the button style. |
| C4 | Tab toolbars are inconsistent: some tabs have an H2 title, some do not; refresh icon and counts move around. | Standard tab toolbar: `[search] [filters] … [count · refreshed time · ⟳] [⋯]`. Remove tab-level H2 titles; the tab name is the title. |
| C5 | Header icons ⌘ # ⤢ have no labels; ⌘ means nothing on Windows. | Phase 0: tooltips with shortcut per platform. Phase 3: replace ⌘ and # with one command bar. |
| C6 | Record identity is raw: `invoice #817701`. | `Invoice · INV-00123` with `#817701` as a copyable chip. Record type label from metadata; fall back to the ID. |
| C7 | Disabled primary buttons ("Explain with AI", "Compare records") have low contrast and no reason. | Disabled state follows DESIGN.md tokens; tooltip says why ("Select log entries first"). |
| C8 | Long monospace IDs break mid-word with a gap (`custbody_iv_ rolependingforapproval`). | `overflow-wrap: anywhere` on ID text; type label on its own line in narrow layouts. |

## Tab-by-tab findings

### Record (Fields)

- Two-column table wastes width below ~480px. Stack label/value on one line and ID · type below.
- Checkbox values show `T`/`F`. Show ✓ Yes / ✗ No.
- Empty fields (—) fill the list. Add a "Hide empty" toggle and remember it.
- "Copy as" and "Open in console" are secondary. Move into a `⋯` menu in the section header.
- Rename "IDs on page" to "Show IDs on NetSuite page".
- Sticky section headers ("Body fields", sublists).
- Row actions (hover or `⋯`): *Where used*, *Automation touching this field*, *Query in SuiteQL*.

### Automation

- "Plan Where used (1 files)" is unclear. Rename to "Scan these files in Where used (1 file)".
- Count chips "Workflow Action 1 / Workflows 1" look like filters but are not. Either make them
  real filter chips (C3) or turn them into the section index (jump links).
- The "Order is approximate" banner is permanent. Move it to an ⓘ next to the list heading.
- Each card has 5 actions. The title links to the script; keep "Where used" as one button;
  put "Add file to Where used", Deployment and File links in `⋯`.
- Add a "Logs" link per script (opens Logs filtered to that script ID).
- Later: group by event (beforeLoad, beforeSubmit, afterSubmit, client) as a timeline view.

### Console

- Editor has a fixed tall height with 4 lines of SQL; results get less space. Editor auto-grows
  (min 4, max 12 lines) with a drag handle between editor and results.
- Result columns use fixed widths and truncate (`CUSTOMRECORD_IV_CONSOLI…`) while the table
  has empty space. Auto-size columns to content, allow column resize, show full value on hover,
  copy cell on click.
- "Run query" and "Run selection" become one split button; the label changes to
  "Run selection" when text is selected.
- The `×` next to the toolbar is ambiguous. Use a labelled "Clear" or remove it.
- History and snippets are hidden in a collapsed block below the results. Move to a toolbar
  button that opens a side drawer.
- The help paragraph at the bottom moves into an ⓘ popover. Keep "Drafts saved locally" as
  muted text in the toolbar.

### Logs

- Three notices (deployment info, 1,000-log limit, AI not set up) push the list ~350px down.
  - Deployment info: ⓘ next to the Filters button.
  - Limit: merge into the count line: "1,000 logs (limit reached — narrow the filters)".
  - AI not set up: remove the banner. "Explain with AI" stays visible; its tooltip and an empty
    state inside the selection bar link to Settings.
- Scope is unclear: invoice context shows account-wide map/reduce logs. Add a scope control:
  "This record type ▾ / All scripts", default to this record type when scripts are known.
- Level as a colored badge (ERROR red, AUDIT neutral, DEBUG muted); ERROR rows get a left accent.
- Selection checkboxes show only in selection mode ("Select for AI" button), so rows are wider.
- "Group similar errors" looks focused, not selected. Use `ToggleChip` (C3).
- Relative time ("5 min ago") with the absolute time in a tooltip; sticky day dividers.

### Inspector (Raw data)

- The JSON tree starts at the `nsResponse` wrapper and draws a bordered box per level; real
  fields sit 4 levels deep. Unwrap the response by default, open at the record fields, and use
  a borderless DevTools-style tree with indentation guides.
- "Screen-share" and "Mask" chips are unclear. One toggle: "Mask values (for screen sharing)".
- Compare and Related transactions are not raw data. Move Related transactions to the Record
  tab (a "Related" section). Make Compare an action ("Compare with…") available from the header
  menu and the command bar; accept an internal ID or a pasted NetSuite URL.
- Rename tab to "Raw data" (see navigation phase).

### RESTlets

- Clean already. Add: copyable external URL, method badges once known, a "Logs" link per
  deployment. Make "Build request" the card's main action and move Script/Deployment links to
  the card footer as they are now.

### Where used (main issue)

Problem: the configuration form uses ~1,000px (half the panel) and stays expanded after the
scan. Results start below the fold and the user scrolls for every file. In addition, the
results area repeats status text per file.

Target layout (search-first, like VS Code Search or GitHub code search):

```
┌──────────────────────────────────────────────┐
│ [cseg_iv_building             ] [Scan ▸]  ⚙ │  ← sticky
│ 97 files · 2 libraries excluded · index 24h  │  ← options summary, click opens ⚙
├──────────────────────────────────────────────┤
│ 13 possible references in 4 files  ⓘ  ⟳ 2m  │  ← one honest caveat in ⓘ
│ (All 97) (With refs 4) (None 93) (Unread 0)  │
│ [Filter files…                    ]          │
├──────────────────────────────────────────────┤
│ ▾ sl_cp_mass_create_approve_page.js   4 refs │
│   Suitelet · customscript_iv_sl_cp_mass…     │
│   L741:44  var b = rec.getValue('cseg_iv_…   │
│   L769:44  …                                 │
│ ▸ sl_create_journal.js                7 refs │
└──────────────────────────────────────────────┘
```

Changes:

1. **Collapse configuration after a scan** into the one-line summary. "Edit options" re-opens it.
2. **Options in a popover/disclosure (⚙):** folder ID, library exclusions, index caching,
   "Advanced: choose files manually". Each keeps its full explanation in an ⓘ, not inline.
3. **One scan button.** "Scan" uses the index when present; "Rescan from source" lives in the
   `⋯` menu and in the results header (⟳). Remove the separate "Refresh scan" button.
4. **Remove the finished progress bar.** Show progress only while scanning, inline under the
   search row; when done, show the results header.
5. **Hoist repeated per-file status** ("Source link unavailable", "Results use a local index",
   "Updated…", "Some excerpts are unavailable") into one results-level line with a single
   "Rescan to load excerpts" action.
6. **Compact reference rows:** `L741:44` + code excerpt with the match highlighted when
   available; "Identifier token" becomes a small tag. Clicking a row opens the file at the line.
7. **Show script name and type instead of `File #279`**: load script metadata and file names
   automatically after a scan (read-only, same queries as today), removing the manual
   "Load script metadata" and "Load file names" buttons.
8. **Results order:** file list first (sorted by reference count), Reference summary table
   moves to a collapsible "Coverage" section at the bottom. The warning "Only supplied files and
   saved searches are checked…" stays, shortened, inside the ⓘ next to the count and in Coverage.
9. **Entry points:** prefill the target from Record/Automation row actions; field ID typeahead
   from record metadata.
10. **Full-tab layout:** at ≥ 1000px, options and coverage on the left, results on the right.

### AI

- "AI is not set up" repeats in each section. Show it once at the top as a setup card; the
  sections below render in a disabled state.
- AI Context Export makes no AI call but sits under AI. Move it to the Docs tab as an export
  preset.
- Six export buttons in one row become `[Copy ▾]` and `[Download ▾]` with a Markdown/JSON
  segmented control.
- Later: make AI a header button that opens a drawer usable from any tab (see Phase 2).

### Docs

- The preview is raw Markdown in monospace with mostly-empty columns. Render the Markdown,
  hide all-empty columns, add a coverage summary and a table of contents at the top.
- Merge with AI Context Export as presets: "As-built document" and "AI agent context". Shared
  record type picker (combobox, prefilled from the page) and shared Copy/Download menus.

## Phased plan

Each phase is a separate PR series. UI changes run `pnpm verify` and `pnpm test:e2e`.
New strings go through `t()`; DESIGN.md tokens only.

### Phase 0 — Quick wins (low risk, no IA change)

- C1 plural support in `t()` + migrate count strings (`impact.planFromRecord`,
  `logs.occurrences`, AI export counts, …).
- C3 `ToggleChip` primitive in `src/shared/ui/`; adopt in Record, Automation, Logs, Where used.
- C5 tooltips on header icons; C7 disabled-reason tooltips; C8 ID wrapping.
- Record: checkbox formatting, "Hide empty", rename "IDs on page".
- Logs: level badges, error accent, merge limit notice into the count line.
- Automation: rename "Plan Where used", banner → ⓘ.
- Console: auto-size result columns, full value on hover.
- AI: single setup card.

Exit: no plural grammar errors in `en.ts`; new e2e check "max one banner per tab".

### Phase 1 — Where used redesign

- Items 1–8 from the Where used section.
- Split `ImpactAnalysis.tsx` (currently one large form + results) into `ScanBar`,
  `ScanOptions`, `ScanProgress`, `ResultsHeader`, `FileResultSection`, `CoverageSection`.
- Keep all security-privacy behaviour: index caching rules, no source text stored,
  "possible reference" wording, read-only queries.

Exit: Playwright at 400×720 — after scanning the fixture, the first file row is in the viewport;
existing impact e2e specs updated through `tests/e2e/harness.ts` helpers.

### Phase 2 — Navigation and information architecture

Needs an ADR that supersedes the tab-order part of ADR 0050 (priority+ and workspace roles stay).

- Two-level navigation: **Record** (Fields · Automation · Raw data · Related) and
  **Tools** (SuiteQL · Logs · Impact · RESTlets · Docs). AI becomes a header button that
  opens a drawer from any tab. Settings stays pinned.
- Renames: Record → Fields, Inspector → Raw data, Console → SuiteQL, Where used stays
  (or "Impact" — decide in the ADR with user feedback).
- Move Related transactions to Record; Compare becomes an action; AI Context Export moves to Docs.
- Workspace roles order sub-tabs instead of one flat row.
- Remember the last sub-tab per record type (per account, local only).

Exit: e2e `navigationNames` updated; every feature still reachable in ≤ 2 clicks; feature flags
and Safe mode still hide tabs.

### Phase 3 — Home, record summary and connections

- **Context-aware landing:** on first run or on a page without a record, show Home (feature
  groups with one-line descriptions, recent records, Go to record). On a record page, open the
  record view directly.
- **Record summary strip** under the header: `159 fields · 1 script · 1 workflow · 3 errors
  (24h)`. Each count opens the matching tab. Counts come from cached metadata; errors only when
  the Logs feature is on.
- **Tab badges:** Automation count, Logs error dot.
- **Cross-links:** field → Where used / Automation / SuiteQL; script → Logs / Where used;
  log → script in Automation.
- **One-time tour:** 3–4 dismissible coach marks, re-openable from a "?" header menu.
- **Empty states** per tab explaining what the tab shows and why it is empty.

### Phase 4 — Power features

- Command bar (`Ctrl/⌘K`) that merges command palette, Go to record and field search.
- Automation timeline by event.
- Full-tab split layouts (Where used, Console, Logs).
- Console history/snippets drawer; schema autocomplete.

## Open questions (resolved)

1. Tab name: **Impact** (ADR 0052, user decision). Row shortcuts read "Check impact of <id>";
   the results still state coverage and never give a risk verdict.
2. Logs scope: a "Scripts on <record type> / All scripts" control. It defaults to the record
   type only when scripts from the Automation Map cache have loaded logs (`// VERIFY:` in
   `LogViewer.tsx` for the script ID match).
3. Home reuses workspace roles for the order of groups' tabs.

## Done after the first pass

- Tab renamed **Where used → Impact** (ADR 0052).
- Console: drag handle between editor and results (`role="separator"`; arrow keys, Home/End,
  Enter or double-click fits the query again). Height is kept for the panel session.
- Record: section headers (Body fields, Sublists, each sublist) stick under the toolbar.
- Record: per-field "Query {id} in SuiteQL" for custom body fields (`custbody_`, `custentity_`,
  `custitem_`, `custrecord_`), built by `fieldConsoleSql` with a `// VERIFY:` comment. Standard
  and line fields get no action, because their record IDs often differ from SuiteQL columns.
- Logs: "Show in Automation" on a log entry whose script is deployed on the page's record type;
  the Automation tab opens and scrolls to that card.
- Logs: relative time ("3 hours ago") once the user sets the account's log time zone in
  Settings (this account). Unset shows account time only; the zone is not guessed.
- AI Assistant: labelled button at the end of the group row, ADS discovery color; the header ✦
  icon is gone (ADR 0053). AI setup lives in the drawer; Settings sections are collapsible.

## Not done yet

- Record: per-field "Automation touching this field". No field-to-script mapping is verified;
  "Check impact of <id>" (Impact scan) answers the question with stated coverage instead.
- Tab badge for Logs counts only logs the Logs tab already loaded (no query just for a badge).
