# PRD-06 release checklist

Local source completion does not mean the public launch acceptance criteria have passed.

Use the [PRD-01–06 validation matrix](../validation/prd01-06-matrix.md) for inherited product gaps
and sandbox/manual checks. Closing PRD-06 packaging tasks does not close earlier PRD acceptance.

## Build and review

- Run `pnpm verify`, `pnpm test:e2e`, `pnpm docs:build` and `git diff --check`.
- Run `pnpm launch:assets`; inspect fixture screenshots and the 75-second demo.
- Package the production extension with `pnpm zip`; fixture data must not be bundled.
- Extension candidate: manifest version `1.0.0`, display version `1.0.0-rc.1`. Remove the candidate suffix only after external release gates pass. The MCP package is `1.0.0-beta.1` until live platform verification.
- Build and review the npm tarball using `pnpm --filter netsuite-suitelens-mcp pack`.
- Run a dependency audit; resolve high/critical production findings before publication.
- Review the published permission/privacy disclosures against the manifest and actual behavior.

## Required maintainer inputs and external proof

- Dedicated security email (required by docs/security-privacy.md); confirm it routes privately.
- Verified active GitHub Sponsors/Ko-fi/Buy Me a Coffee destinations.
- Hosting choice and live docs/privacy URL (static output is `.site/`, no server dependency).
- GitHub private vulnerability reporting **enabled and rechecked October 6, 2026**.
- `good first issue` **verified on GitHub October 6, 2026**; `.github/labels.json` documents scoped label definitions. Do not overwrite other repository labels.
- Test real sandbox approval and `get_record_schema("salesorder")` from Claude Code. Save a
  redacted tool/approval transcript, not record values or session credentials.
- Verify production default denial, revocation and DELETE/UPDATE rejection in the live integration.
- Verify Chrome native host installation/uninstallation on macOS, Linux and Windows before
  advertising support for each platform.
- Publish npm package, record package URL/version, test a clean single-command install.
- Deploy docs and inspect the public privacy page and all navigation links.
- Review store media and upload the demo, record its public URL.
- Submit Chrome Web Store listing; record approval and test public install from a clean profile.
- Complete beta tester feedback, then execute the PRD launch communication plan only with
  explicit publication/message authorization.

No email, sponsor URL, store ID, release version or hosted URL is fabricated in this checkout.
