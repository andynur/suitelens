# PRD-03 — v0.3 Dev Toolbox: Record Inspector, RESTlet Tester, Log Viewer

| | |
| --- | --- |
| Status | Implemented with log deployment limits; sandbox acceptance pending |
| Target | Dec 2026–Jan 2027 (4 weeks) |
| Tier | Community |
| Depends on | v0.1, v0.2 (editor, table, exports) |

Progress reconciled on October 6, 2026. Checked items establish only the evidence described
below; sandbox and external acceptance remain separate. See the
[validation matrix](../docs/validation/prd01-06-matrix.md).

## 1. Goal

Cover the daily debugging loop: inspect raw record data, test RESTlets, and read execution logs comfortably,
so developers stop hopping across many NetSuite pages.

## 2. Features & requirements

### 2.1 Record Inspector
- F-3.1 Show the active record as XML (`&xml=T`) and normalized JSON, with folding and search.
- F-3.2 Related-transaction tree (created from, applied to, fulfillment, invoice, payment) for transactions; data via SuiteQL (`VERIFY` relationship tables).
- F-3.3 Copy/download the payload; optional automatic masking of sensitive-looking fields (on by default in screen-share mode).
- F-3.4 **Mini Record Compare:** compare two records of the same type in the same account, field by field.

### 2.2 RESTlet Tester
- F-3.5 List RESTlet deployments in the account (via SuiteQL) with search.
- F-3.6 Request builder: method, query params, JSON body (editor), extra headers.
- F-3.7 Send using the user's session (same-origin) and show status, time, size and a pretty-printed response body.
- F-3.8 Save requests as per-account collections; environment presets (sandbox/prod) with variables.
- F-3.9 Clear warning before sending non-GET methods to production.
- F-3.10 VERIFY: how RESTlets behave when called with the browser session on the domains involved; fall back to a clear message when another auth method is required.

### 2.3 Log Viewer
- F-3.11 Full-page execution log across scripts with filters for script, deployment, level, time range and text.
- F-3.12 Grouping of similar errors (title + normalized message) with occurrence counts.
- F-3.13 Log detail with a JSON viewer when the content is JSON.
- F-3.14 CSV export; links to the script/deployment.
- F-3.15 Optional auto-refresh (minimum interval 30 seconds).
- F-3.16 In-UI note that NetSuite purges user-generated logs after about 30 days and system errors after about 60 days.

### 2.4 Command Palette
- F-3.17 Ctrl/Cmd+K in the side panel: jump to features, open records, open snippets, open a script by ID.

## 3. Non-functional requirements

- NF-3.1 Log Viewer shows the first 1,000 rows in < 2 s.
- NF-3.2 Record payloads are never stored permanently unless the user saves them.

## 4. Acceptance criteria

- [x] Record Inspector shows XML and JSON for a sales order, a customer and a custom record (unit and fixture Chromium E2E; real-account XML compatibility remains VERIFY).
- [ ] The transaction tree shows SO → Fulfillment → Invoice → Payment on fixture data and is verified on a real account.
- [x] RESTlet GET and POST calls succeed and the response is shown; POST on production asks for confirmation (unit and light/dark fixture Chromium E2E; live session compatibility remains VERIFY).
- [x] Log Viewer filters by ERROR level and keyword, and grouping shows counts per group (unit and light/dark fixture Chromium E2E).
- [x] The command palette opens Field Explorer and the RESTlet Tester with the keyboard only (Ctrl and Meta shortcuts; light/dark fixture Chromium E2E).

### Implementation checklist

- [x] Search UX: shared literal match highlights in Record, Automation, Inspector XML/JSON and Console history/snippets; matching automation details and SQL are visible while searching.
- [x] F-3.1 Active saved-record XML and normalized ordered JSON with folding, search and manual refresh. JSON is the default view; Inspector follows Console and precedes Settings. Account/record/tab checks, credential removal before transport, bounded parsing, memory-only payloads and a Settings feature toggle. Unit and fixture E2E cover all three record types, both themes and the LiveAdapter transport (ADR 0011).
- [x] F-3.2 Related-transaction tree implementation: on-demand, bound-ID SuiteQL adjacency reads through the adapter; duplicate links, reverse traversal, shared/cyclic records, limits and navigation cancellation. Unit and light/dark fixture Chromium E2E cover SO → Fulfillment and SO → Invoice → Payment branches (ADR 0013). Live relationship columns and payment semantics remain VERIFY; combined real-account acceptance above stays unchecked.
- [x] F-3.3 Copy/download complete XML or JSON payloads independently of search/folding; optional name-based business-field masking shared by display and exports, enabled when entering screen-share mode. Memory-only controls, generic copy toast, scoped filenames and disabled exports during loads/errors. Unit and light/dark fixture Chromium E2E cover masking and exports (ADR 0014).
- [x] F-3.4 Mini Record Compare within one account and record type: explicit numeric-ID reads, identity-verified same-origin XML, changed/missing/unchanged field and attribute comparison, positional sublist matching, shared masking, memory-only data and stale-result cancellation (ADR 0015). Unit and light/dark fixture Chromium E2E cover fixture and live transport; sandbox compatibility remains VERIFY.
- [x] F-3.5 RESTlet deployment list: account-wide read-only adapter SuiteQL, strict mapping, 1,000-row cap and partial-read warning, literal search highlights, script/deployment metadata links, exception states, refresh and Settings feature toggle. Memory-only results with target/account checks and cancellation; unit and light/dark fixture Chromium E2E (ADR 0016). Live RESTlet type values, columns and role visibility remain VERIFY.
- [x] F-3.6–F-3.10 RESTlet request builder, same-origin session execution, bounded response metrics, per-account collections and sandbox/production variable presets. All non-GET calls require target/environment confirmation; production writes require account opt-in enforced in content service (ADR 0017). Credential rejection and fixture GET/POST/production tests; app-domain RESTlet session compatibility remains VERIFY with an explicit authentication fallback message.
- [x] F-3.11–F-3.16 Account-wide and full-page Log Viewer: latest 1,000 rows through read-only adapter SuiteQL, script/deployment/level/time/text filters, normalized error grouping with occurrence counts, plain/JSON detail, formula-safe CSV and metadata links. Optional non-overlapping refresh at 30/60/120 seconds, retention note and Settings toggle (ADR 0018). Unit and light/dark fixture Chromium E2E; ScriptNote schema, joins, role visibility, time zone and live latency remain VERIFY.
- [x] F-3.17 Ctrl/Cmd+K Command Palette with keyboard feature navigation, validated same-account record/script internal-ID links and local/bundled snippet search. Snippets open as new SQL drafts with parameters without execution; full workspaces wait for a free tab. Settings toggle, Quick Go-to fallback and focus restoration (ADR 0019). Unit and light/dark fixture Chromium E2E cover keyboard-only Field Explorer/RESTlet Tester navigation.

### Remaining manual checks

- [x] Log query correction (ADR 0022): use catalog-confirmed `internalid` in SELECT/ORDER BY, remove speculative `ScriptNote.script`/`scriptdeployment` access, use `scripttype` script reference and raw levels, return null deployment metadata, disable unavailable deployment filtering and add schema/role error guidance. Observed-schema regression fixture added; user reported sandbox recovery on 2026-10-04.
- Sandbox Records Catalog confirmed ScriptNote fields `date`, `detail`, `internalId`, `scriptType`, `title` and `type`. Detailed comparison with native logs remains pending for role coverage, timestamp time zone, latest-row ordering and first 1,000-row latency; fixture checks and user-reported recovery do not establish these properties. Deployment filtering/links remain unavailable until a per-log deployment source is verified.

- Validate RESTlet GET/POST against a sandbox deployment: app-domain endpoint, browser-session permissions, redirects to RESTlet domains, response status and authentication errors. Production confirmation is fixture-tested; do not send production writes for verification.

- Validate RESTlet discovery in a NetSuite sandbox: script/deployment join and columns, `RESTLET` type and status values, role visibility and metadata links. Compare with Script Deployments; fixtures do not prove live-account compatibility.

- Validate Mini Record Compare in a NetSuite sandbox for sales orders, customers and custom records: another internal ID on the active `xml=T` endpoint, returned ID/type attributes, role permissions and custom `rectype` isolation.

- Validate related transactions in a NetSuite sandbox: relationship columns and directions, invoice/payment applications, role visibility, client `N/query` support and generic transaction links. Compare the tree with the NetSuite related-record tabs; fixtures do not prove live-account compatibility.

- Validate `xml=T` availability, response shape and permissions for sales orders, customers and custom records in a NetSuite sandbox. Fixture evidence does not establish live-account compatibility.

## 5. Out of scope

Scheduled error alerts (see backlog: Error Triage & Digest), long-term log retention (Pro).
