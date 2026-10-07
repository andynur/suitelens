# ADR 0022 — Conservative ScriptNote metadata

Status: Accepted

## Context

The sandbox Logs panel returned a SuiteQL failure with only `Unexpected Error`. The original
query assumed `ScriptNote.script` and `ScriptNote.scriptdeployment`, and its fixture returned
fabricated deployment aliases. Exact-query fixture matching proved UI behavior, not SQL validity.
After switching roles, sandbox Records Catalog confirmed the fields `date`, `detail`,
`internalId`, `scriptType`, `title` and `type`. The query also incorrectly used `ScriptNote.id`
in SELECT and ORDER BY; both now use `internalid`. The observed field identifiers are captured
in `fixtures/schema/scriptnote.json` with a regression check of every `n.*` field reference.
The user reported the sandbox issue resolved after this correction. Oracle lists `SCRIPT_NOTE` in
[query.Type](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1510878994.html),
but that does not establish every field or role's access.

## Decision

Use verified `ScriptNote.internalid` for the row ID and ordering, `scripttype` as the script
reference and read `type` directly, retaining strict level validation and the account verification
comment. Remove the speculative deployment
column and join. Return null deployment aliases; never join every deployment of a script to
each log, which would duplicate logs and falsely attribute them to deployments.

Disable the deployment filter when loaded rows contain no deployment metadata and show a local
explanation. Keep script links, other filters, grouping and CSV. Fixtures now reflect the absence
of deployment attribution. Preserve query error codes and NetSuite's detail, adding specific
ScriptNote/Script schema and current-role verification guidance; no automatic fallback query,
permission escalation or alternate NetSuite endpoint is introduced.

## Validation boundary

Fixtures cover null deployment mapping, disabled deployment filtering, script links and error
guidance. The user confirmed sandbox recovery on 2026-10-04; this is user-reported validation,
not an automated live-account test. Detailed comparison of ordering, timestamps, role coverage
and latency with native logs remains pending. Restore deployment attribution
only after verifying an actual per-log deployment source. Oracle's
[Records Catalog guide](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_159367848537.html)
documents the catalog permission; its absence does not itself prove missing log permissions.
Oracle's [execution-log permission guidance](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4413330369.html)
sets Setup > SuiteScript at View as the minimum for viewing deployment execution logs. This
does not prove that a particular SuiteQL join is accessible to the same role.
