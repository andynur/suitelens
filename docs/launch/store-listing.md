# Chrome Web Store listing draft

## Title

SuiteLens for NetSuite

## Short description

Field IDs, scripts, workflows and SuiteQL beside any NetSuite record. Production-safe. No server, no tracking. Open source.

Same text as the manifest `description` in `wxt.config.ts`.

## Detailed description

SuiteLens for NetSuite is a free, open-source toolkit for NetSuite developers, administrators and
consultants. Explore the record in front of you: field IDs, scripts/workflows, saved payloads,
SuiteQL queries and execution logs. Find possible change-impact references in bounded sources with
explicit coverage limitations.

See everything. Touch nothing. No server, no account, no tracking: SuiteLens has no backend and
does not collect user data. Your session, your role: it uses the NetSuite session in your tab, so
it sees only what your role already sees, and stores no credentials. Production-safe: core
exploration and all MCP tools only read; explicit RESTlet writes have named confirmations and a
separate production guard. Don't trust us, read the code: MIT licensed.

Data and caches stay local. Optional AI uses your own key and asks you to review a preview before
sending. Optional local MCP allows a coding agent on your computer to read bounded context/results
after one-hour account approval; that agent may forward received data under its own provider
policies. Production MCP is off by default.

Features can be disabled individually. Safe mode turns them all off. Delete cached and stored
SuiteLens data in Settings. Local feature counters are opt-in and have no automatic upload.

Single purpose: Developer and admin productivity tools for NetSuite: explore the current record's fields, automations and data in a side panel.

NetSuite is a trademark of Oracle Corporation. This project is not affiliated with Oracle.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `sidePanel` | Show the workbench beside the NetSuite record |
| `storage` | Local settings, account caches/drafts and session-only approvals/UI metadata |
| `scripting` | Inject the bundled content script into an already open NetSuite tab after a user action |
| `activeTab` | Toolbar gesture access to the user's chosen tab; no broad history access |
| `https://*.app.netsuite.com/*` | Read context and issue same-origin session requests only on NetSuite UI hosts |
| Optional AI provider origins | Requested only for the selected BYOK provider, for explicitly previewed AI calls |
| Optional `nativeMessaging` | Requested only by Connect this tab; communicates with the locally installed, origin-restricted MCP host |

No remote executable code, credential collection, advertisement or telemetry endpoint.
Do not claim Limited Use compliance beyond the implemented policy and reviewed store disclosures.

## Media and publication fields

Capture screenshots and the 60–90 second demo only with FixtureAdapter and fabricated fixture data.
Run `pnpm launch:assets` to produce 1280×800 screenshots and a 75-second browser walkthrough.
Review all media before submitting. The video is a local WebM artifact; upload to the store-supported
video host and enter that URL only after review. Required icon: public/icon/128.png (rendered from assets/brand/logo.svg with `pnpm brand:icons`).

Run `pnpm store:assets` for the framed listing media in `assets/store/`: five 1280×800
screenshots, the 440×280 small promo tile, the 1400×560 marquee and a 1280×640 GitHub social
preview.

Store ID, public install URL, hosted privacy URL, support contact, video URL and submission/approval
are pending; see release checklist. Do not submit the fixture extension as the product package.
