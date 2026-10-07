# ADR 0046 — Context custom record references

Status: Accepted

## Decision

Derive outgoing custom record references from the active field list-source metadata introduced
by ADR 0045. Require resolved status, a custom-record identifier and custom-record-ID provenance.
Exclude display-name candidates and ambiguous/unmapped sources. Group targets with deduplicated
body field or sublist/field references, retaining distinct sublist locations.

Context Export schema version 2 changes relatedCustomRecords to these outgoing references,
with relatedCustomRecordsBasis set to active-field-list-source. Move the former account index
to accountCustomRecords and a separate Markdown section. Derivation works even when the
optional account index cannot be read; it adds no queries, storage or AI calls.

## Consequences

This is a bounded relationship slice, not complete related-record discovery. Incoming links,
fields absent from the active snapshot, name-only sources and full target schemas remain
unchecked. An empty reference list does not prove the absence of relationships. Existing
ADR 0045 installed-adapter and restricted-role validation gates remain open. JSON consumers
must handle schema version 2; Markdown and MCP resources share the same generator.
