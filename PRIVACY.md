# Privacy Policy — SuiteLens for NetSuite

Last updated: October 6, 2026. Covers the features currently implemented in the repository,
including optional AI Assist and local MCP; public v1.0 publication is pending.

## What SuiteLens accesses

SuiteLens reads the NetSuite page URL, form labels, record fields, saved record XML, script,
deployment, workflow and catalog metadata through your existing browser session and role.
Explicit actions may read SuiteQL results, execution logs, linked File Cabinet source, saved-search
definitions or the open PDF editor. It never stores NetSuite passwords, cookies or access tokens.
Role visibility and source limitations apply; it does not read account data through a separate
administrator identity.

## Local storage

Global and account settings, feature toggles, Quick Go-to history and RESTlet collections use
Chrome local storage. Metadata caches, source fingerprints/reference positions, SuiteQL drafts,
history, snippets and partial catalog metadata use local IndexedDB, isolated by account ID.
Metadata caches expire after 24 hours. Record payloads, query result tables and source text stay
in view memory. User-authored SQL/parameters can remain in drafts and history until deleted.

AI keys are session-only or encrypted locally with a passphrase that is never stored. Unlocked
keys use Chrome session storage until Lock/browser exit. Model settings and daily token counters
are local; no key appears in diagnostics or telemetry.

## When data leaves the browser

Normal NetSuite reads use same-origin requests with your session. Explicit RESTlet writes require
confirmation naming the account/environment and are blocked in production unless separately enabled.

Optional AI Assist sends only the previewed payload to the provider you choose, with your own key,
after you confirm the preview. You can edit, remove and redact items. Review that provider's terms
before sending confidential data. Source and log text can contain personal or client data.

Command Code forwards the previewed payload to the selected model provider. SuiteLens requires
its documented zero-data-retention option on every request and does not retry without it;
requests fail when a compatible route is unavailable. Review [Command Code's policy](https://commandcode.ai/privacy).
For Google Gemini, unpaid-service inputs and outputs may be used to improve Google's products
and reviewed by people; do not submit confidential or personal data through those services.
Paid-service terms require a project with active Cloud Billing, with regional exceptions as
described in [Google's terms](https://ai.google.dev/gemini-api/terms). SuiteLens cannot detect
your key's billing status or guarantee a provider's retention practices.

Optional local MCP sends read-only tool results to a coding agent on this computer through Native
Messaging and local IPC. It defaults off and requires approval per session/account for at most
one hour. Approved tools can return record context, schema, automations, bounded query rows,
possible script references and script source. Production is denied unless separately enabled.
The agent may send received data to its own AI provider under its own policies; SuiteLens does not
control that forwarding. Agent names are self-reported. Navigation, disconnection, disabling the
feature, Safe mode, browser exit and worker restart revoke access. No network listening port or
NetSuite credential is used. See [MCP setup](docs/mcp-setup.md).

## Telemetry

Feature counters are **off by default**. If enabled, SuiteLens stores only counters for opens of
the nine named tabs on this device. No account ID, record value, SQL, parameters, source, URL,
error, timestamp or unique user identifier is included. No analytics endpoint or automatic upload
exists. You can inspect/copy counters and voluntarily share them, delete them, or disable collection
(which deletes the counters). Safe mode stops collection. See [exact collection details](docs/launch/telemetry.md).

The separate MCP activity log stores the last 200 tool/time/account/count/outcome entries in
session storage. It includes no SQL, arguments, result values, source or raw errors, is deletable
in Settings and clears at browser exit/worker restart.

## Delete data

Settings → Data → **Clear cache for this account** removes its cached metadata, catalog metadata
and Quick Go-to history; account preferences and user-authored drafts/snippets are kept.
**Delete all SuiteLens data** clears local/session storage and all SuiteLens IndexedDB stores,
including keys, counters, drafts and snippets. **Delete key** removes the chosen provider key.
MCP Settings → **Delete activity log** clears activity independently. Telemetry Settings →
**Delete counters** clears counters. Uninstalling removes extension-owned browser storage;
uninstall the separate native host using its setup guide if you installed it.

## Contact

Privacy requests: [repository issues](https://github.com/andynur/suitelens/issues).
Vulnerabilities: report privately using [GitHub Security Advisories](https://github.com/andynur/suitelens/security/advisories/new),
not a public issue. A dedicated security contact address must be configured before public launch.

NetSuite is a trademark of Oracle Corporation. This project is not affiliated with Oracle.
