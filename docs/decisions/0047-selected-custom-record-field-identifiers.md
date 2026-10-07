# ADR 0047 — Selected custom record field identifiers

Status: Accepted

## Decision

Expose identifiers from the existing CustomField-to-CustomRecordType metadata mapper for
the requested custom record type, even when that type is not open. Match the exact table
identifier, use only custom-definition metadata and valid custrecord_ identifiers, deduplicate
and sort. Derive this section before the 200-type account index display cap.

Schema version 2 gains optional selectedCustomRecordFields with custom-field-definitions basis,
fieldIds and partial/not-checked status. Markdown places it in a separate section. Do not add
these identifiers to body/sublist fields, infer labels/types/mandatory flags/list sources,
or infer outgoing relationships. No identifiers means not-checked, not proof of zero fields.
The existing bounded adapter reads and account/cancellation guards are unchanged; disclose
row-limit truncation. No new queries, record reads, storage or AI calls.

## Consequences

This supplies partial identifiers for non-active custom types, not a complete schema source.
Standard non-active types still require a validated source. The existing metadata join and
restricted-role visibility remain VERIFY and require live Records Catalog/native-definition
comparison before closing the PRD acceptance gate. Read failures keep a generic limitation
and never expose raw errors. Fixtures prove mapping and format behavior only.
