# ADR 0042 — AI Context Export (metadata only)

Status: Accepted

Source reads and list-source omissions below describe the initial implementation.
[ADR 0045](0045-context-list-sources.md) extends them with partial active custom-field
list-source mapping; ADR 0046 adds bounded outgoing custom record references and schema version 2.

## Context

PRD-05 §3.5 (F-5.13–F-5.17) asks for a generator that describes a record type for coding
agents (Claude Code, Codex, Cline) as Markdown and JSON, plus a `CLAUDE.md`/`AGENTS.md`
snippet. It must contain metadata only (F-5.16) and must not call an AI provider. Field
information comes from `getRecordFields`, which also returns record values, and live reads
only cover the record open in the tab.

## Decision

**Sources.** Everything goes through `NetSuiteAdapter`: `getRecordFields` (only when the
requested type is the active record type), `getAutomations`, and the existing
`METADATA_SOURCES` queries `customrecordtype` and `customfield` via `runSuiteQL` (row cap
5,000, account checked). No new SuiteQL. Each source is optional: a failure becomes a line in
the file's limitations; the export fails only when no source could be read.

**Values never leave.** Fields are copied through an explicit allow-list (ID, label, type,
mandatory, custom). `value`, line counts, record ID, account ID and host are never in the
model. The file carries the generation date and record type only.

**Model and formats.** `src/features/ai/export/contextModel.ts` builds a typed, versioned
model (`schemaVersion: 1`) and renders Markdown (body fields, custom body fields, sublists,
related custom records, active scripts and deployments, workflows, general governance notes,
limitations) and JSON. Table cells escape `|`, backslashes and line breaks; identifiers are
code spans without backticks. Labels are marked as data, not instructions.

**Unknowns.** List sources of select fields are not exposed by any current source, so the
column stays empty (`// VERIFY:`) instead of guessing. Related custom records are all custom
record types visible to the role (up to 200), labelled as such, because references from
select fields cannot be determined. Inactive or undeployed automations are left out.

**UI.** An AI tab section behind the `aiContextExport` flag: explicit Generate, progress,
`ErrorPanel`, Markdown preview as text, copy (Markdown, JSON, agent snippet) and download
(`<recordtype>.md` / `.json`, with a hint to save under `netsuite-context/`).

## Consequences

- Exports from a non-active record type contain no fields until a record of that type is
  opened; the UI and the file say so.
- Governance notes are general SuiteScript guidance, not account-specific measurements.
- MCP exposure of the files (F-5.17) is deferred to v1.0.

ADR 0046 supersedes the account-index meaning of relatedCustomRecords described above: schema
version 2 separates outgoing active-field references from accountCustomRecords. Incoming and
complete relationship coverage remain deferred.

ADR 0047 extends non-active custom type exports with a separate partial definition-identifier
section. Active body/sublist fields still require an open record; full schema coverage remains pending.
