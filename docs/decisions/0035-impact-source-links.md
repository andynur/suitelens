# ADR 0035 — Transient links for impact source files

Status: Accepted

## Context

The combined UE script, saved search and PDF fixture acceptance criterion requires
references with the correct source and link. Saved searches already expose a validated
object link, but file results had no link to their observed source.

## Decision

Expose the download URL returned by a fresh adapter read in run-local progress only.
Validate HTTPS, same origin and account, exact file ID, allowed parameters and absence
of credentials/fragments using the existing File Cabinet download-link rules.
An invalid display URL is omitted without losing readable candidate positions.
Render it as an external source link with `noreferrer noopener`.

Keep URLs out of checkpoint and content-index schemas: download links may contain a
hash. Restored, resumed and index-only results have no file link unless that file was
read in the current run. Explain that Refresh can recover links for accessible sources.
No additional network requests or guessed object/editor URLs are introduced.

## Consequences

One explicit fixture scan finds the field in UE, PDF and saved-search definitions,
with source locations and correct links in both themes. File links open downloaded
source rather than a script deployment or Advanced PDF editor. Live download behavior,
verified object names/editor links and active/released risk metadata remain pending.
