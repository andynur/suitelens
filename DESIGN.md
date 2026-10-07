# DESIGN.md — UI rules for coding agents

SuiteLens UI follows the **Atlassian Design System (ADS)** — <https://atlassian.design>.
Read this file before touching any `.tsx` or `style.css`. It complements `CLAUDE.md`.

## 1. Source of truth

- Token values mirror `@atlaskit/tokens` **20.2.0**, themes `atlassian-light` and
  `atlassian-dark`, plus `atlassian-shape`, `atlassian-spacing` and `atlassian-typography`.
- We do **not** install `@atlaskit/*` packages. We mirror the token values in
  `src/entrypoints/sidepanel/style.css` and expose them as Tailwind 4 utilities. Reasons: bundle
  size, and the "no remote code, no CDN" rule in `CLAUDE.md`.
- Every `--c-*` variable in `style.css` has a comment with the ADS token it mirrors. Keep that
  1:1 mapping.
- Decision record: `docs/decisions/0006-atlassian-design-system.md`.

## 2. Hard rules

1. **Use tokens only.** No raw hex, `rgb()`, Tailwind palette colors (`bg-blue-500`,
   `text-white`, `bg-slate-*`) or arbitrary colors (`bg-[#...]`) in components.
   Exception: colors the user picks (environment colors). Render them with
   `readableTextOn()` from `src/shared/ui/color.ts` so the text stays readable.
2. **No opacity modifiers on tokens** (`bg-danger/10`, `border-line/60`). ADS gives a token for
   each tint, so use `bg-danger-bg`, `bg-selected`, `bg-muted`, etc.
3. **No arbitrary sizes** (`text-[11px]`, `rounded-[3px]`, `p-[5px]`). Use the scales below.
   Only exception: `LOZENGE_CLASS` (11px, which is ADS Lozenge).
4. **Use the shared primitives** in `src/shared/ui/` before writing new markup. Do not restyle
   them at the call site. `cn()` does not merge conflicting classes (there is no
   `tailwind-merge`), so `className="px-2"` on a `Button` gives undefined results. If you need a
   variant, add a prop to the primitive.
5. **Every state works in light and dark.** Tokens switch on their own under `.dark`. Never use
   `dark:` with raw colors.
6. **All UI copy goes through `t()`**, including `aria-label` and the Spinner label.

## 3. Color tokens

| Tailwind utility                           | ADS token                                         | Use for                                                    |
| ------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------- |
| `bg-surface`                               | `elevation.surface`                               | Header, tab bar, cards, containers, inputs                 |
| `bg-surface-overlay` + `shadow-overlay`    | `elevation.surface.overlay` / `shadow.overlay`    | Floating UI: toasts (Flag), popovers, menus                |
| `bg-canvas`                                | `elevation.surface.sunken`                        | Panel background behind cards                              |
| `bg-muted` / `-hovered` / `-pressed`       | `color.background.neutral[.hovered/.pressed]`     | Default button, hover of rows / subtle buttons            |
| `bg-selected` / `-hovered`                 | `color.background.selected`                       | Selected / pressed toggle state (`isSelected`, `aria-pressed`) |
| `border-line`                              | `color.border`                                    | Dividers, card and table borders                           |
| `border-line-input`                        | `color.border.input`                              | Text fields, selects, color inputs, Switch track (off)     |
| `ring-focus` / outline `--c-focus`         | `color.border.focused`                            | Focus indicators (global `:focus-visible` already set)     |
| `text-fg`                                  | `color.text`                                      | Body text, values                                          |
| `text-fg-muted`                            | `color.text.subtle`                               | Labels, secondary text, table headers, default button text |
| `text-fg-subtlest`                         | `color.text.subtlest`                             | Meta: timestamps, counts, source notes, disclaimers        |
| `text-fg-inverse`                          | `color.text.inverse`                              | Text on bold backgrounds (primary/danger buttons)          |
| `bg-accent` / `-hovered` / `-pressed`      | `color.background.brand.bold`                     | Primary button, Switch on                                  |
| `text-accent` / `border-accent`            | `color.text.selected`, `color.link`, `border.selected` | Links, active tab, field-ID copy buttons              |
| `text-info` + `bg-info-bg`                 | `color.text.information` / `background.information` | Information messages, info lozenge                       |
| `text-discovery` + `bg-discovery-bg`      | `color.text.discovery` / `background.discovery`   | AI entry points only (AI Assistant button); hover `bg-discovery-bg-hovered` |
| `text-success` + `bg-success-bg`           | `color.text.success` / `background.success`       | Success messages, "Released" lozenge                       |
| `text-warning` + `bg-warning-bg`           | `color.text.warning` / `background.warning`       | Warnings, "Testing" / "Hidden" lozenges                    |
| `text-danger` + `bg-danger-bg`             | `color.text.danger` / `background.danger`         | Errors, validation text, "Mandatory" lozenge               |
| `bg-danger-bold` / `-hovered`              | `color.background.danger.bold`                    | Danger button only                                         |

Pair semantic text with its own background (`text-warning` on `bg-warning-bg`). Both themes
meet WCAG AA for these pairs. Other combinations are not checked.

## 4. Typography

The font stack is ADS `font.family.body` / `font.family.code` without the Atlassian Sans/Mono
webfonts, which are not bundled. `html` is set to 14px / 20px.

| Role (ADS token)                 | Classes                          | Where                                                  |
| -------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `font.heading.xsmall` 14/20      | `text-sm font-semibold`          | App title, section headings (`h2`), empty-state title  |
| `font.heading.xxsmall` 12/16     | `text-xs font-semibold`          | Sub-group headings (`h3`), field labels, table headers |
| `font.body` 14/20                | `text-sm`                        | Tabs, buttons, inputs, radios, toasts                  |
| `font.body.small` 12/16          | `text-xs`                        | Dense content: tables, cards, messages, meta, hints    |
| `font.code`                      | `font-mono` + the size of its context | IDs, script IDs, file names, account IDs          |
| Lozenge                          | `LOZENGE_CLASS` (11px bold caps) | Status labels only                                     |

- The minimum size is 12px (`text-xs`). Only lozenges go smaller.
- Use `font-semibold` for headings and `font-medium` for buttons and tabs. Use `font-bold`
  only in lozenges.
- Do not use uppercase or letter-spacing for headings. Only lozenges are uppercase.

## 5. Spacing

ADS uses an 8px base (`space.100`). Use these Tailwind steps only:

| ADS        | px | Tailwind |
| ---------- | -- | -------- |
| space.025  | 2  | `0.5`    |
| space.050  | 4  | `1`      |
| space.075  | 6  | `1.5`    |
| space.100  | 8  | `2`      |
| space.150  | 12 | `3`      |
| space.200  | 16 | `4`      |
| space.300  | 24 | `6`      |
| space.400  | 32 | `8`      |

Panel conventions:

- Panel content padding is `p-3`.
- Gap between blocks is `gap-2`.
- Card padding is `p-3`.
- Gap between inline items is `gap-1`.
- Do not use 10px or 14px steps (`2.5`, `3.5`).

## 6. Radius

Tailwind 4's default radius scale already equals ADS radius tokens. Pick the radius by
element role, not by taste:

| Tailwind      | ADS token        | px  | Use for                                                     |
| ------------- | ---------------- | --- | ----------------------------------------------------------- |
| `rounded-xs`  | `radius.xsmall`  | 2   | Checkbox-sized details, inline field-ID copy button          |
| `rounded-sm`  | `radius.small`   | 4   | Lozenges, compact buttons (all our `Button`s), color swatches |
| `rounded-md`  | `radius.medium`  | 6   | Text fields, selects (`fieldClass`)                          |
| `rounded-lg`  | `radius.large`   | 8   | Cards, `<details>` containers, section messages, toasts      |
| `rounded-xl`  | `radius.xlarge`  | 12  | Large page containers (not used yet)                        |
| `rounded-full`| `radius.full`    | —   | Switch track and thumb, avatars                              |

Do not use plain `rounded`.

## 7. Elevation

- Flat (the default): `bg-surface` + `border border-line`. Use it for cards and containers in
  the panel.
- Overlay: `bg-surface-overlay shadow-overlay`. Use it only for UI that floats above content
  (toast, future menu or popover).
- `shadow-raised` is for draggable cards. We have none yet.
- Never use Tailwind's `shadow-sm`, `shadow-lg`, etc.

## 8. Components (`src/shared/ui/`)

| Primitive              | ADS equivalent    | Rules                                                                                   |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `Button`               | Button (compact)  | `variant`: `primary` (one main action per view), `secondary` = ADS default, `ghost` = ADS subtle (toolbar actions such as Refresh), `danger` (only the Confirm button of a destructive confirm). Use `isSelected` (with `aria-pressed`, or `role="switch"` + `aria-checked`) for toggles such as filter chips and the Go-to toggle. `spacing="compact"` (12px text) for filter-chip rows. An icon goes before the text as a child. |
| `IconButton`           | Icon button       | Square 24px button with only an icon. `label` is required and becomes `aria-label` and `title`. Subtle (`ghost`) by default. Use it for row actions (Show on page) and dense toolbars (Refresh next to a count). |
| `Badge` / `LOZENGE_CLASS` | Lozenge (subtle) | `tone`: `success` positive status, `warning` caution or in progress, `danger` blocking or required, `info` informational, `custom` brand or custom, `neutral` default. Keep the text short. Max width is 200px, then it truncates. |
| `SectionMessage`       | Section message   | In-page callouts with an icon. `appearance`: `information` / `warning` / `error` / `success`. Use `role="alert"` for errors and `role="alertdialog"` for inline confirmations. Put buttons in `actions`. |
| `ErrorPanel`           | Section message (error) | Use it for every `SuiteLensError`. It has a retry action and folded details.          |
| `Skeleton`             | Skeleton          | Loading state for content with a known shape: `variant="rows"` for tables, `variant="cards"` for card lists. It has a hidden `label` (`t('app.loading')`) and `role="status"`. |
| `Spinner`              | Spinner           | Loading state without a known shape (panel bootstrap, context detection). It always has a visible label. |
| `SearchHighlight` | Search match | Literal, case-insensitive `<mark>` matches with `bg-warning-bg text-fg`; preserves source text and optional underscore wrapping. |
| `EmptyState`           | Empty state       | Use it when there is nothing to show, never a blank area. Title plus a one-line body.   |
| `Dialog`               | Modal dialog      | Blocking review step only (the AI send preview). Covers the panel with `bg-surface-overlay shadow-overlay`, `role="dialog"` + `aria-modal`, labelled title, focus trapped inside, Escape cancels, focus returns on close. Primary action last. |
| `Switch`               | Toggle            | For on/off settings that apply right away. Use a radio group for 3 or more options.     |
| `ToggleChip`           | Filter chip       | On/off filters in a toolbar ("Custom", "Hide empty", "Deployed only"). Pill shaped, check mark and `bg-selected text-accent` when on, `aria-pressed` (or `role="switch"` + `aria-checked`). Buttons keep the button style; never use a `Button` for a filter. |
| `Menu`                 | Dropdown menu     | `⋯` (or a text trigger) for secondary actions: copy formats, extra links, run options. `label` is the trigger's name and tooltip. Arrow keys move, Escape returns focus. |
| `InfoTip`              | Inline help       | ⓘ button with a small popover. Use it for explanations instead of a helper paragraph or a permanent information banner. `label` names what it explains ("About execution order"). |
| `MarkdownView`         | —                 | Renders SuiteLens-generated Markdown as text nodes (never HTML). Hides table columns that are empty in every row; optional table of contents. |
| `Toaster` (via `toast()`) | Flag           | Short, transient confirmation ("Copied memo"). Never use it for errors that need action. |
| `fieldClass` / `fieldClassCompact` | Text field / Select | Every `<input>`, `<select>` and `<textarea>`. Add the width (`w-full`) at the call site. Use the compact variant only inside dense toolbars. |
| Radix `Tabs` (in `Panel.tsx`) | Tabs       | `text-sm font-medium`. Selected tab gets `text-accent` + a 2px `border-accent` underline. The group switch above the tabs (`GroupNav`: Home, Record, Tools) is a segmented control with `aria-pressed` (ADR 0052). |

Banners: at most one `SectionMessage` above a tab's main content, and only for actionable or
warning states (`data-banner` lets e2e count them). Explanations go into an `InfoTip`; scan-wide
status is listed once in a results header, not on every card.

Links use `text-accent hover:underline`. Links that leave the app add ` ↗` and
`target="_blank" rel="noreferrer noopener"`.

Icons: there is no icon library. `src/shared/ui/icons.tsx` holds the inline SVG glyphs
(`InfoIcon`, `CopyIcon`, `CheckIcon`, `RefreshIcon`, `ChevronRightIcon`, `SearchIcon`,
`LocateIcon`, `TagIcon`): 16×16 viewBox, 1.5 stroke, `currentColor`, `aria-hidden`. Add new
glyphs there in the same style; size them with `h-3.5 w-3.5` in `text-xs` rows. Do not add an
icon package without an ADR.

Brand: `LogoMark` (also in `icons.tsx`) is the product logo tile in the full-tab panel header:
24px `rounded-sm bg-accent` with a `text-fg-inverse` glyph, tokens only. The source artwork lives
in `assets/brand/*.svg` (ADS `color.background.brand.bold` tile, white lens glyph). Run
`pnpm brand:icons` after changing it to re-render `public/icon/*.png`; never edit the PNGs by hand.

## 9. Patterns

- **Panel header:** two fixed lines (environment lozenge + account in `text-xs`, then the record
  in `font-mono text-sm font-medium` as a button that copies the internal ID), then icon-only
  actions (`IconButton`: Commands ⌘K, Go to `#`, Open in full tab). The lines truncate; they never
  re-wrap. The environment lozenge never shrinks. `LogoMark` shows only when the panel runs as a
  full tab (`?targetTab=`); Chrome's side panel title already shows the product.
- **Tab row (ADR 0050):** priority+ navigation in `sidepanel/TabBar.tsx`. Feature tabs follow the
  workspace role order (`src/shared/workspace.ts`); the ones that fit stay in the row, the rest go
  to a **More** menu (`role="menu"`, label + one-line description per entry). The selected tab is
  always in the row. Settings is a pinned icon tab at the right edge. Never wrap or scroll tabs.
- **Panel layout:** the header and tab list never scroll vertically. The tab body
  (`Tabs.Content`, `overflow-y-auto`) is the only scroll container. Do not add `min-h-screen`
  or another scroll container inside a tab.
- **SuiteQL results exception (ADR 0009):** the raw query table uses a bounded `h-80`
  scroll viewport, fixed 32px rows, pixel column widths and horizontal scrolling. It keeps all
  returned columns, with a sticky header and virtual spacer rows. Dynamic widths and spacer heights
  are structural measurements, not spacing tokens.
- **Tab toolbars** (search, filters, counts, actions) are sticky at the top of the tab body:
  `sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-canvas p-3`. The content
  follows in `flex flex-col gap-2 p-3`. Order: search row (search + one toggle or a compact
  select), filter-chip row (`spacing="compact"`), meta row (count, info icon, refresh as
  `IconButton`, then secondary actions right-aligned as `IconButton`s or compact ghost buttons).
  Keep the tab title as an `sr-only` `h2`; the selected tab already names the view.
- **Advanced filters and options** that most people skip (date ranges, IDs, row limits, query
  names) fold behind a toolbar `Button` with `aria-expanded` (`Filters (n)` shows the active
  count). The primary content must be visible without scrolling past forms.
- **Main content first:** the thing the tab is about (payload, results, logs) comes right after
  the toolbar; secondary tools (compare, related records, history) and fixed limitation notes
  follow it. Limits that apply to every read go in a `text-xs text-fg-subtlest` footer, not a
  banner above the content.
- **Async views** always show these states: `Skeleton` (or `Spinner` when the shape is
  unknown), then `ErrorPanel` (with retry) or content. Use `EmptyState` when there is no data,
  and a centered `text-xs text-fg-muted` line when filters hide everything.
- **Destructive actions:** the trigger is a `secondary` button. It opens an inline
  `SectionMessage` with `appearance="warning"` and `role="alertdialog"`. That message holds the
  `danger` Confirm button and a `secondary` Cancel button (see Settings → Data). Writes to
  NetSuite also follow the confirmation rules in `CLAUDE.md` §4.
- **Exception-only status:** show a lozenge only when something differs from the normal state
  (Mandatory, Hidden, Testing, Not deployed). Never repeat the normal state ("Standard",
  "Released") on every row; it hides what needs attention. Items that cannot run are shown
  last in their group, with a dashed `border-line-input` border and `text-fg-muted` title.
- **Tables** use `text-xs`. Headers are `font-semibold text-fg-muted`. Rows are
  `group border-b border-line hover:bg-muted`. Use `table-fixed` with percent widths and at most
  three columns in the side panel; put secondary data (field type) under the primary value in
  `text-fg-subtlest`. IDs with underscores insert `<wbr>` after each `_` and use
  `wrap-anywhere`, so they break between words, not inside them. Short enums use `truncate` +
  `title`.
- **Row actions** (copy, show on page) appear on row hover and on keyboard focus:
  `opacity-0 group-hover:opacity-100 focus-within:opacity-100`. A copy shows a `CheckIcon` in
  `text-success` for 1.5s plus a toast.
- **Collapsible groups** use `<details className="rounded-lg border border-line bg-surface">`.
  The `summary` has `px-2 py-1.5 hover:bg-muted`. Wrap the content in `px-2 pb-1`.
- **Collapsible cards** (lists of 5+ items with details) show name, exception lozenges and the
  ID when collapsed. Details and links open on click. The `summary` is `list-none` with a
  `ChevronRightIcon` that rotates 90° (`group-open/card:rotate-90`).
- **Meta lines** (counts, timestamps, sources) use `text-xs text-fg-subtlest`. Timestamps are
  relative (`formatRelativeTime` + `useNow` from `src/shared/time.ts`) with the full date in
  `title`. Technical detail (data sources) goes behind an `InfoIcon` with `role="img"`,
  `aria-label` and `title`, not in the visible line.
- **Keyboard:** `⌘K` / `Ctrl+K` toggles Command Palette and `Escape` closes it. Quick Go-to keeps the shortcut when Command Palette is disabled. Show a shortcut in
  the control's `title` and `aria-keyshortcuts`.
- **Heading hierarchy:** tab content `h2` = heading.xsmall. Groups inside it use `h3` =
  heading.xxsmall in `text-fg-muted`.

## 10. Accessibility

- Focus: the global `:focus-visible` gives a 2px `--c-focus` outline with a 2px offset. Fields
  use `focus:border-focus focus:ring-1 focus:ring-inset focus:ring-focus`. Never remove focus
  styles without a replacement.
- Color is never the only signal. Lozenges carry text, and section messages carry an icon
  and/or a title.
- Animations respect `motion-reduce:` (see `Spinner`, `Switch`).
- Interactive elements keep their native roles (`button`, `switch`, `tab`, `searchbox`). E2E
  tests select by role and name, so keep accessible names stable.
- Form fields have a visible `<label>` or an `aria-label`.

## 11. Theme

The `settings.theme` values are `system` (the default), `light` and `dark`. `useTheme()` in
`src/entrypoints/sidepanel/useBootstrap.ts` toggles `.dark` on `<html>`. Check every UI change
in both themes. The e2e harness can emulate it with
`page.emulateMedia({ colorScheme: 'dark' })`.

## 12. Adding or changing a token

1. Find the ADS token in the installed `@atlaskit/tokens` version, in both the light and dark
   artifacts: `dist/esm/artifacts/themes/atlassian-{light,dark}.js`. You can read these at
   design time from the npm tarball. Never load them at runtime.
2. Add `--c-<name>` to `:root` (with a comment naming the ADS token) and to `.dark`.
3. Register it in `@theme inline` as `--color-<name>: var(--c-<name>)`, or `--shadow-*` for
   shadows.
4. Add a row to §3 of this file.

## 13. Scope and known gaps

- Scope: the side panel (`src/entrypoints/sidepanel`, `src/features/*`, `src/shared/ui`).
  The UI injected into NetSuite pages (Environment Guard banner, field-ID badges) has its own
  self-contained styles. When you touch it, use the same token values.
- No Atlassian Sans webfont. Bundling it locally needs a license check and an ADR.
- No Tooltip primitive yet. The native `title` attribute is used for now.
- "Show on page" outlines a field on the NetSuite page with ADS `color.border.focused`
  (`#1868DB`) as an inline style, because the page does not load our tokens.

## 14. PR checklist (UI changes)

- [ ] Only tokens and the scales above. No raw colors, no opacity modifiers, no arbitrary px.
- [ ] Uses existing primitives. A new primitive is added to `src/shared/ui/` and §8.
- [ ] Loading, empty and error states covered.
- [ ] Checked in light **and** dark.
- [ ] Keyboard focus is visible. Names and roles are stable for e2e.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass.
