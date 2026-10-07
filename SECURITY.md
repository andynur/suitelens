# Security Policy

SuiteLens for NetSuite runs inside an ERP that holds companies' financial data, so security
reports come before any other work.

## Supported versions

Only the latest release (currently the `1.0.0` release candidate) and the `main` branch receive
security fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub's
"Report a vulnerability" button (Security → Advisories) on the repository.

<!-- A dedicated security email address will be added before the first public release
     (docs/security-privacy.md §6). -->

Include the affected version, steps to reproduce and the impact you expect.

## Response targets

- Acknowledgement and first assessment: within **72 hours** for critical reports.
- Fixes ship with an honest changelog entry.

## Scope

In scope: the extension code in this repository (background worker, content script, MAIN-world
bridge, side panel), the packaged local MCP server/native host and installer, their message
protocols, session approvals and storage. Out of scope: NetSuite itself.

## Design rules we hold ourselves to

See [docs/security-privacy.md](docs/security-privacy.md): no remote code, no `eval`, no stored
credentials, host permissions for NetSuite only, nonce-checked bridge with an operation
allow-list, data stays local except explicitly previewed AI and approved local MCP access, and NetSuite HTML
is never inserted as HTML. MCP exposes only allow-listed reads, with one-hour account approval
and production denied by default. Coding-agent forwarding is disclosed before approval.
