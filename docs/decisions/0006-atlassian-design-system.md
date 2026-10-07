# 0006 — Atlassian Design System as the UI foundation

- Status: Accepted
- Date: 2026-10-04

## Context

The side panel used ad-hoc Slate/Blue Tailwind colors, mixed radii (`rounded`, `rounded-md`,
`rounded-full`), opacity-tinted backgrounds and 10–11px text. Each feature styled its own
inputs, messages and loading states. Contributors and coding agents had no reference to keep
new UI consistent.

## Decision

- Adopt the **Atlassian Design System** (atlassian.design) as the visual language. NetSuite
  users already know ADS from Jira and Confluence, and it ships light and dark tokens.
- **Mirror the token values** from `@atlaskit/tokens` 20.2.0 (light, dark, shape, spacing,
  typography) as CSS variables in `src/entrypoints/sidepanel/style.css`. Expose them through
  Tailwind 4 `@theme inline`. Do **not** depend on `@atlaskit/*` packages, because of bundle
  size and the "no remote code / CDN" rule.
- Tailwind's default radius scale already equals ADS `radius.*`. Spacing and typography map to
  existing Tailwind steps, so no custom scales are needed.
- Add shared primitives that mirror ADS components: `Button` (with `isSelected`), `Badge`
  (Lozenge), `SectionMessage`, `Spinner`, `Switch` (Toggle), `Toaster` (Flag) and
  `fieldClass` (Text field).
- Environment colors are chosen by the user. They stay user-defined, and their text color is
  picked by contrast (`readableTextOn`).
- `DESIGN.md` at the repo root holds the rules, the token map and a PR checklist.

## Consequences

- Components must not use raw colors, opacity modifiers or arbitrary sizes. Review against
  `DESIGN.md`.
- When ADS updates its tokens, the update is manual: re-read the token artifacts and update
  `style.css` and `DESIGN.md` together.
- The Atlassian Sans/Mono fonts are not bundled, so system fallbacks are used.
- The UI injected into NetSuite pages is out of scope for now.
