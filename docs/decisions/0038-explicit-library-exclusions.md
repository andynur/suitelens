# ADR 0038: Explicit library filename exclusions

Status: Accepted

## Context

Large third-party libraries such as lodash and Luxon can reach the bounded local token index
limits. Treating every long file as a library would also hide business scripts and internal
libraries that contain NetSuite identifiers. File Cabinet names do not establish provenance.

## Decision

Provide an off-by-default, view-local switch for **Scan all scripts** with an editable list
initially containing `lodash.js` and `luxon.js`. Match exact, case-sensitive `.js` basenames
only, with at most 50 entries of 512 characters; reject paths and wildcards. Every discovered
file with a listed name is excluded, regardless of folder. Users must review that choice.
Manual file plans remain explicit and bypass these exclusions.

Apply exclusions after bundle filtering and before the 500-file plan cap. No new NetSuite API
or query is introduced. Files with unreadable metadata stay included. Excluded files receive
no source reads, index lookups or scan result entries. Display their names, IDs, count and
**Skipped: excluded library** separately from unreadable results, with a disclosure that their
references were not checked. Scan progress and reference summaries count included files only.
If every discovered file is excluded, show the exclusions with an actionable all-files-excluded error;
never report a completed or fully checked scan.

Changing the switch or list clears discovery results and the old scan plan. Refresh/resume
uses the filtered plan, so exclusions apply consistently. Names and exclusion choices remain
in the mounted account/page/adapter-scoped view; no additional storage is introduced. Cached
checkpoints contain only the included plan and cannot restore the skipped-file disclosure.
A new discovery is required after remount. This does not prove account-wide coverage or safety.

## Validation

Unit tests cover exact matching, bounds, metadata failure, filtering before the plan cap,
source-read avoidance, refresh, re-inclusion and an entirely excluded inventory. Fixture browser
tests cover the control and disclosure in both themes. Sandbox behavior of the new control
remains unverified; user screenshots show the preceding live scan, not this implementation.
