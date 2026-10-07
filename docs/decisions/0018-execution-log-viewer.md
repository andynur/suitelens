# ADR 0018 — Bounded execution log viewer

Status: accepted

The account-wide Logs feature reads ScriptNote through the existing read-only SuiteQL adapter,
with a 1,000-row cap and strict mapping. All SQL stays in `netsuite/queries/logs.ts`. Column names,
level display values, role visibility, deployment joins and returned account timestamp timezone
remain VERIFY in the account Records Catalog. Unsupported columns or result shapes produce a
visible error instead of inventing an alternate API. Fixtures establish extension behavior only.

Log rows, filters and grouping remain in component memory. Script, deployment, level, inclusive
minute-resolution time range and literal text filters apply to the latest loaded rows. The UI
states this scope; counts are not account-wide aggregates. Errors group by level, title and a
normalized message that replaces volatile numeric IDs, UUIDs, timestamps and whitespace. Original
messages and occurrences remain available as text; valid JSON is formatted without executing HTML.
CSV uses the shared formula-safe exporter and includes every filtered occurrence, not group summaries.
Links use existing validated account-local script/deployment URL builders.

A 100-group page keeps rendering bounded while all 1,000 rows are indexed. The fixture test loads
and indexes 1,000 rows in under two seconds; live query latency is not proven by this test. Optional
refresh uses 30/60/120-second timeouts after a settled read, preventing overlapping polls. Errors,
unmount, disabled feature and target changes stop pending reads and timers. The full-page entrypoint
`logs.html?targetTab=<id>` reuses the panel and pins its target using the existing workbench mechanism.

The retention note follows [Oracle Governance on Script Logging](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N3352137.html):
user-generated logs are purged after around 30 days and system errors after around 60 days. Search
and deployment repositories can lose logs sooner due to storage limits. No persistent log archive
or scheduled collection is introduced.
