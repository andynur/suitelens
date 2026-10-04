# PRD-03 — v0.3 Dev Toolbox: Record Inspector, RESTlet Tester, Log Viewer

| | |
| --- | --- |
| Status | Draft |
| Target | Dec 2026–Jan 2027 (4 weeks) |
| Tier | Community |
| Depends on | v0.1, v0.2 (editor, table, exports) |

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

- [ ] Record Inspector shows XML and JSON for a sales order, a customer and a custom record.
- [ ] The transaction tree shows SO → Fulfillment → Invoice → Payment on fixture data and is verified on a real account.
- [ ] RESTlet GET and POST calls succeed and the response is shown; POST on production asks for confirmation.
- [ ] Log Viewer filters by ERROR level and keyword, and grouping shows counts per group.
- [ ] The command palette opens Field Explorer and the RESTlet Tester with the keyboard only.

## 5. Out of scope

Scheduled error alerts (see backlog: Error Triage & Digest), long-term log retention (Pro).
