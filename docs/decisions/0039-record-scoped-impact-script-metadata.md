# ADR 0039 — Record-scoped script metadata for impact candidates

Status: Accepted

## Context

F-4.3/F-4.5 need script identities and activity evidence. File Cabinet names and source
matches establish neither. The existing Automation Map adapter exposes script-record
metadata for the current record type, with explicit missing-column/source warnings.

## Decision

Offer an explicit Load script metadata action when the scan includes script files.
Reuse `NetSuiteAdapter.getAutomations` for the current record type; introduce no query,
bridge operation, object URL or broader discovery. Validate the exact page, account and
record type before and after the lookup and the response account/type. Cancel locally
on adapter replacement or unmount and discard late replies.

Match metadata only by File Cabinet ID against script results with candidate hits,
including partial and dynamic hits. Deduplicate script records by internal ID across
deployment rows. Report enabled only when every observed inactivity flag is explicitly
false, inactive only when all are explicitly true, otherwise activity unknown. Enabled
does not establish deployment, release status, execution or runtime usage. Files without
matching metadata have a separate unknown-activity count; they are never inactive or
unused by inference. Workflow rows do not contribute to script counts.

Show escaped script-record names, internal IDs and matching file IDs with the metadata
timestamp, incomplete-source disclosure and current-record coverage boundary. Metadata
is view-local, keyed by adapter/account/page/plan, outside checkpoints and content indexes.
List filtering does not change counts. Reload explicitly checks for changes.

## Consequences

This is a bounded F-4.3/F-4.5 slice, not completion of either requirement. Existing
Automation Map columns retain their VERIFY limitations. Installed-adapter validation,
object-link round trips, deployment/release-backed risk assessment and other script
kinds/record types remain open. Fixture tests establish UI/guard behavior only.
