# ADR 0032 — Batched discovery queries

Status: Accepted

Supersedes the query shapes of ADR 0031; the discovery behaviour it describes is unchanged.

## Context

"Scan all scripts" (ADR 0031) failed with `TIMEOUT` in a production-sized sandbox, before any
file was read. Two query shapes were responsible:

- `SELECT DISTINCT f.* FROM script s INNER JOIN file f ON f.id = s.scriptfile ORDER BY f.id`
  joins, de-duplicates and sorts the whole `file` table against every script record of the
  account, including bundled ones. It did not answer inside the 30-second query timeout.
- The folder walk ran two statements per folder (`file WHERE folder = ?` and
  `mediaitemfolder WHERE parent = ?`). With the 200-folder cap, a scan of SuiteScripts (`-15`)
  issues up to 400 sequential statements, so one slow statement fails the whole scan.

## Decision

- Read script file IDs from one table: `SELECT DISTINCT scriptfile FROM script`. File names and
  sizes are read afterwards for the capped ID set only, with `file WHERE id IN (…)` in batches of
  100.
- Walk the folder tree level by level, with `folder IN (…)` and `parent IN (…)` batches of 100,
  and stop as soon as the 500-file plan cap is reached.
- Metadata is presentational: a failed detail read sets `detailsUnavailable` and keeps the
  discovered IDs, which are what a scan needs. Cancellation still propagates.
- A `TIMEOUT` during discovery carries a detail naming the next step — retry, or narrow the scan
  to a subfolder.

## Consequences

A folder-free scan issues one statement plus up to five detail batches instead of one join over
the `file` table. A folder tree of N folders issues `2 × ceil(N / 100)` statements per level
instead of `2N`. VERIFY: live timing in an account remains open (NF-4.1/NF-4.2), as does the
modified-date/size skip of F-4.7.

## Addendum — classified read failures

The first successful live scan read 500 files and reported 214 as not checked with
`INVALID_RESPONSE`, which names no cause. Result records store error codes only, by the storage
rule of ADR 0023 (no raw error text), so the cause was unrecoverable from the panel.

Source read failures are therefore classified into a closed set (`no-link`, `html-page`,
`not-text`, `not-pdf-xml`, `too-large`, `empty`, `unreadable`, `timeout`, `permission`,
`http-error`) authored in `impact/source.ts` and stored as `failure` on the result. The panel
shows one grouped line per distinct cause above the file list, so a repeated failure reads as one
fact. No NetSuite error text is stored or displayed.

## Addendum 2 — permanent failures are not retried

Live evidence: the 214 failures are `GET /core/media/media.nl?id=…&c=…&h=…&_xt=.js` answering
`500 (Internal Server Error)`, identically on two runs. The files sit in `SuiteBundles : Bundle
<id> : src` with "Hide in SuiteBundle" set, so NetSuite will not serve bundle-owned source.
The cause is permanent per file, not rate limiting.

HTTP failures are therefore split by status (`not-found` 404, `throttled` 429, `server-error`
5xx, `http-error` otherwise). Kinds in `PERMANENT_FAILURES` are cached per account/adapter/file
under the `impact-miss` cache kind for 7 days, so a later target reports them immediately
instead of paying a request plus the 250 ms inter-read delay each time. Refresh clears the path
by re-reading. Transient kinds (`throttled`, `timeout`, `unreadable`, …) are never cached. The
account index opt-out clears `impact-miss` with `impact-index`.

Still open: these files consume the 500-file plan cap although they can never be read, so live
coverage is 286 of 787 files. Excluding the SuiteBundles subtree at discovery, with the skipped
count disclosed, would spend the cap on readable files instead.

## Addendum 3 — bundle files leave the plan

Probe in the sandbox: `SELECT id, name, parent FROM mediaitemfolder WHERE name = 'SuiteBundles'`
returns one row, `id = -16`, `parent = null`, in 479 ms.

Discovery now reads file details for every candidate (capped at 2,000) *before* the 500-file plan
cap, resolves each distinct folder's ancestor chain upwards in batches of 100 to a depth of 20,
and leaves files under the bundle root out of the plan. Walking up is bounded by tree depth;
enumerating the bundle subtree downwards is not. The root is resolved by name rather than by the
observed `-16`, which is not documented as stable (VERIFY), and an unreadable root or chain keeps
every file, so the skip can only be lost, never wrongly applied.

Skipped files are disclosed as a count, not hidden: NetSuite serves no source for them, so
listing each one as "not checked" would be noise, while silence would overstate coverage.
