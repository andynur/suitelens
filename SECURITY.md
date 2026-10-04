# Security Policy

SuiteLens for NetSuite runs inside an ERP that holds companies' financial data. We treat security
reports as the highest priority.

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
bridge, side panel), its message protocol and its storage. Out of scope: NetSuite itself.

## Design rules we hold ourselves to

See [docs/security-privacy.md](docs/security-privacy.md): no remote code, no `eval`, no stored
credentials, host permissions for NetSuite only, nonce-checked bridge with an operation
allow-list, data stays in the browser, and NetSuite HTML is never inserted as HTML.
