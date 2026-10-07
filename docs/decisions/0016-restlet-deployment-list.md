# ADR 0016 — Account-wide RESTlet deployment discovery

Status: accepted · Scope: PRD-03 F-3.5

## Context

The next Dev Toolbox task discovers RESTlet deployments before request construction and execution.
Discovery needs to work on any NetSuite account page, including lists, and respect the user's role.

## Decision

- Reuse `NetSuiteAdapter.runSuiteQL` and its schema-validated, read-only, account-pinned transport.
  Keep the query and strict Zod mapper in `netsuite/queries/restlets.ts`; introduce no new bridge
  operations, host permissions, credential handling or write paths.
- Join script deployments to scripts, filter to RESTlets, order by deployment primary key and cap
  the read at 1,000 rows. Show a partial-read warning; search is local to the returned rows.
- Validate numeric identities, script type, flags and text bounds. Reject malformed or conflicting
  rows with a Records Catalog explanation rather than silently presenting an empty list.
- Add a RESTlets tab after Inspector and a Settings feature toggle. Display script/deployment IDs
  and account-scoped metadata links, highlight literal matches and mark inactive/undeployed
  exceptions. Sort these exceptions after available deployments.
- Load on tab entry and manual refresh. Keep metadata in component memory only. Check the target
  account/page before and after reads; abort local waits on navigation, adapter change or unmount.

## Consequences

The [Oracle Analytics Browser deployment schema](https://www.netsuite.com/help/helpcenter/en_US/srbrowser/Browser2021_1/analytics/record/scriptdeployment.html)
documents `primarykey`, `script`, `scriptid`, `status` and `isdeployed`. VERIFY in a sandbox: the
current script join/columns, `RESTLET` type value, status values, metadata links and role visibility.
Unit and fixture Chromium E2E evidence cannot establish current live-account compatibility.
The bounded list can omit deployments in larger accounts. Being listed does not establish permission
to execute a RESTlet. Request building, session execution and collections remain later tasks.
