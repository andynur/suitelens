# ADR 0015 — Same-account Mini Record Compare

Status: accepted · Scope: PRD-03 F-3.4

## Context

The Inspector reads saved XML for the active record. Developers need to compare it with another
record of the same type without persisting ERP payloads or accepting arbitrary request URLs.

## Decision

- Add an explicit comparison option to `NetSuiteAdapter.getRecordXml` and its Zod-validated
  content request. The default remains restricted to the active record.
- Accept a different numeric internal ID only for the active record type and account. Derive
  the request from the active same-origin record endpoint, preserving custom `rectype`; accept
  no caller-supplied URL. Recheck account, active record URL and target tab after the read.
- Comparison responses must identify the requested record ID and type. Strip credentials before
  transport and retain existing XML complexity limits and error/retry paths.
- Start the read on form submit. Keep both payloads in component memory; context changes,
  clearing, newer requests and unmount invalidate pending results. Hide comparisons whenever
  the active payload is unavailable, including refresh and errors.
- Compare leaf text and attributes without numeric/date coercion. Match element names and named
  field/sublist wrappers with occurrence indexes; sublist lines match by position, not business
  identity. Record IDs remain values rather than path keys. Missing values differ from empty strings.
- Apply Inspector masking to both trees before computing and rendering differences. Show changed,
  active-only and other-only fields by default, with an unchanged-fields toggle. Bound rendered
  rows to 1,000 and state the limit; the difference count covers the complete parsed payload.

## Consequences

VERIFY: same-type `xml=T` reads with another internal ID, role permissions and custom-record
endpoint behavior require sandbox validation. Fixture Chromium E2E exercises both adapter modes,
keyboard submission and light/dark themes; it does not establish real-account compatibility.
Line-position comparison can report differences after line reordering. Name-based masking can hide
real differences and does not guarantee anonymization. The UI explains these limits.
No new permissions, write operations, permanent payload storage or remote services are introduced.
