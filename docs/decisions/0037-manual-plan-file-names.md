# ADR 0037 — File names for manual impact plans

Status: Accepted

## Context

Account discovery already reads File Cabinet names, but manual file plans and restored
checkpoints display only IDs. F-4.3 needs understandable source names without implying
that a file is a script record, a deployment or a persisted PDF template.

## Decision

Offer an explicit "Load file names" action on a file scan. Reuse `fileDetailsSql` through
`NetSuiteAdapter.runSuiteQL`, with supplied IDs as parameters, at most 100 IDs per sequential
batch and a 500-file plan cap. No new NetSuite API, source download or object URL is introduced.
Check the exact page and account before and after each query, and the returned account.
Abort on unmount or adapter replacement; discard late replies. Only mapped, nonblank names
for IDs in the requested batch are accepted. Missing or inaccessible names keep their IDs.
An error has its own retry and does not remove scan results or existing discovery names.

Keep labels in the mounted panel only, outside checkpoints and token indexes. Key the label
view by account, page and scan plan; edits and remounts drop loaded names. Reload replaces
prior lookup labels. Render names as escaped text, using the existing file cards and filters.
Disclose that these are File Cabinet names, not script object names or activation evidence.

## Consequences

Manual and restored scans can acquire useful labels without rereading source. Unknown names
do not become permission or source-coverage verdicts. Existing download links are unchanged.
The query columns were probed in one sandbox for discovery (ADR 0031); installed-adapter and
restricted-role behavior still need live validation. F-4.3/F-4.5 remain incomplete until
object identities/links and activation/release metadata are verified.
