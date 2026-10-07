# ADR 0045 — Context list-source metadata mapping

Status: Accepted

## Context

PRD-05 F-5.14 asks for select-field source identifiers. User-supplied sandbox probes
confirmed standalone CustomField source IDs/display labels, ScriptRecordType keys/names,
and CustomRecordType internal IDs/script IDs. A combined display-name join was rejected.
Some labels match multiple keys, and positive source IDs can refer to custom lists rather
than custom records. Oracle's [metadata example](https://blogs.oracle.com/developers/extracting-netsuite-records-metadata)
describes these sources and display-name limitations.

## Decision

Extend ADR 0042 with three separate SELECT queries through NetSuiteAdapter, using bound
parameters. Read definitions for at most 100 deduplicated active custom body/column field
IDs, then matching positive custom-record IDs and display names. Each read caps at 1,000
rows. Truncated or invalid metadata discards enrichment; optional failures produce a
generic limitation. Cancellation and account changes abort the export. No values, select
options, raw errors, account IDs or source numeric IDs enter the export or storage.

Resolve positive IDs only through an exact custom-record internal-ID match. Negative IDs
can produce a unique exact display-name candidate, labelled `unique-display-name`; this
is weaker evidence than stable ID identity. Multiple distinct matching keys are ambiguous.
Missing positive custom records remain unmapped even if a label has a single candidate.
Duplicate field definitions are ambiguous. Do not guess custom-list IDs or canonical names.

Schema version 1 gains optional field properties: listSource, listSourceLabel,
listSourceStatus and listSourceBasis. Markdown exposes the identifier with its basis, or
the label with an unresolved status. Runtime field values remain excluded by an explicit
allow-list. Standard fields and unreturned definitions have no source metadata.

## Consequences

- Standalone manual probes do not validate integrated bound queries or restricted roles.
  Keep those live gates open and retain defensive VERIFY comments.
- Renamed/localized labels, custom lists and standard-field identities remain incomplete.
- This does not implement custom-field sourcing/filter rules, workflow/form definitions,
  schema reads for non-active types, or record-specific related-custom-record lists.
- Fabricated fixtures cover direct IDs, duplicate labels, missing mappings, caps, cancellation,
  account changes and value exclusion; browser exports retain unresolved status in both themes.
