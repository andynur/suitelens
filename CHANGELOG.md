# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versions follow SemVer.

## [Unreleased]

### Added (v0.1 — MVP Foundation)

- Side panel with Record, Automation and Settings tabs; header with account, environment and record.
- Field Explorer: body and sublist fields with label, ID, type, value and flags; search, filters, copy formats.
- Show field IDs on page (off by default).
- Automation Map: client, user event, workflow action scripts and workflows per record type, 24 h per-account cache.
- Environment Guard: banner and favicon tint, per-account label/color/environment override.
- Quick Go-to with per-account history and keyboard shortcuts.
- Settings: theme, feature toggles, environment colors, clear account cache, delete all data, About.
- `NetSuiteAdapter` with `LiveAdapter` (nonce-checked MAIN-world bridge) and `FixtureAdapter` (fake fixtures).

### Fixed (first sandbox check)

- Session token fields such as `_csrf` and `_eml_nkey_` are never read, shown or copied.
- Workflows load again: the `workflow` table uses `internalid`, not `id`; multi-record workflows match through `recordtypes`.
- Field ID badges keep the real case inside uppercase NetSuite labels.

### Changed (first sandbox check)

- Automation cards summarize execution contexts ("All contexts", "All except …", "+N more").
- Field Explorer lists form fields first in page order and folds hidden and system fields.
- View mode shows field types through a read-only `N/record.load`.
- Address values show line breaks instead of literal `<br>`.
