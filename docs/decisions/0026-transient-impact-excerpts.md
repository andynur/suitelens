# ADR 0026 — Transient script reference excerpts

Status: Accepted

## Context

PRD-04 F-4.4 needs nearby code for script-file candidates. The linked-file workbench already
reads bounded content but its checkpoints must remain positions/status only. Cached positions
cannot reconstruct source text, and rereading silently would defeat incremental resume.

## Decision

During a fresh adapter read, keep ±3-line excerpts for the first 20 candidates per script file
in run-local memory and detached progress snapshots. Retain the existing 500-character line
limit and disclose clipping, including when the match falls outside the clipped text. PDF
template results remain positions only. No additional requests are made to obtain excerpts.

Keep checkpoint schemas and keys unchanged. Strip excerpts before constructing checkpoint
results; the cache receives positions/status only. Every run starts with a new ephemeral
excerpt map. Restored or resumed completed files therefore have no excerpts; users can choose
Refresh scan to reread them. Editing inputs, restarting or leaving the view clears displayed
excerpts. Navigation/account checks and cancellation still discard in-flight replies.

Render excerpts as escaped React text inside native collapsible details, with one-based line
numbers and the candidate line highlighted using ADS tokens. State that excerpts are never
cached, and explain unavailable excerpts and the per-file cap. Confidence stays possible.

## Consequences

This completes a bounded linked-file F-4.4 slice. Tests cover cache omission, restore/resume,
refresh, excerpt bounds, untrusted markup and light/dark fixture-browser rendering. Verified
object names/links and active/released/public metadata for F-4.3/F-4.5 remain outstanding;
there is no live-account or account-wide coverage claim.
