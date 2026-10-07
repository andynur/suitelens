# PRD-01–06 validation matrix

Reconciled October 6, 2026 (Asia/Jakarta). Source snapshot: `a53722b` before this documentation
update. This matrix records implementation boundaries and required evidence; pending rows are
not completed tests. Checkbox totals are not feature-completion percentages.

## Current evidence

- [CI run 37244542997](https://github.com/andynur/suitelens/actions/runs/37244542997), commit
  `e1d955a`, completed successfully on October 5, 2026 (Asia/Jakarta). The check job ran lint,
  typecheck, coverage tests, production build and zip; the E2E job also passed. This does not
  establish CI success for subsequent AI/MCP/launch changes.
- [PRD-06 local validation](prd06-launch.md) records 817 unit tests, five MCP package tests,
  73 passed E2E cases and one intentionally skipped media case. Later refinements had full
  unit/type/build and focused browser checks; the recorded full browser run preceded them.
- [PRD-04 native source probe](prd04-source-probe.md) establishes observed native source
  surfaces in one Administrator sandbox. It does not establish installed-adapter reads,
  saved-template identity or restricted-role access.
- October 6 browser inspection found a NetSuite sandbox tab with SuiteLens page elements.
  Further navigation was blocked by Chrome because another extension UI was open. No new
  adapter read, schema query, field-coverage measurement or role check was completed.

### Documentation reconciliation checks — October 6, 2026

The documentation update was checked locally against the unchanged application source at
`a53722b`: `pnpm verify` passed (108 unit files, 817 tests, five MCP tests, 12-page docs build
and production extension build); `pnpm test:e2e` passed 73 cases with the media capture case
intentionally skipped. Formatting, local references in the PRDs/matrix/release checklist and
`git diff --check` also passed. These are current local/fixture checks, not a new CI run,
live account validation or public release. No application feature was added in that
documentation reconciliation; the later list-source slice is recorded below.

## Implementation boundaries

| PRD | Available locally | Remaining implementation |
| --- | --- | --- |
| 01 | Foundation, fields, automation map, environment guard, navigation, settings | No open implementation group; acceptance still needs sandbox/install proof |
| 02 | Console, parameters/paging, exports/library, autocomplete, full-tab | Metadata coverage is partial; additional sources need validation |
| 03 | Inspector, transaction tree, compare, RESTlets, logs, palette | Per-log deployment filtering/links need a verified source |
| 04 | Script/PDF/search candidates, discovery, indexing, source summaries | Workflow/form/field-sourcing definitions; verified object links and active/released risk metadata |
| 05 | BYOK providers, preview, explain, SuiteQL drafts, Context Export with partial custom-field list-source mapping | Integrated list-source/role validation, remaining source identities, incoming custom record relationships, outgoing-reference live validation, fields for non-active record types |
| 06 | Hardening, onboarding, docs/media, approved read-only local MCP | Maintainer contact/sponsor configuration and external release gates |

## Manual and live checks

Perform account checks in a sandbox with the installed production candidate. Confirm the displayed
account/environment and build before starting. All account reads go through `NetSuiteAdapter`;
do not inject ad hoc bridge calls, reuse session credentials or query through a separate endpoint.
For unsupported definitions, inspect Records Catalog/native metadata first rather than guessing APIs.

| Scope | Procedure | Evidence required before closing the item |
| --- | --- | --- |
| PRD-01 fields | Open a Sales Order; compare body and item-sublist fields with the native record | Returned schema/source identities and expected field IDs; no stored values |
| PRD-01 badges | Enable field badges on standard forms; count eligible labels and correct badges | Form/type, denominator, matched count and ≥90% coverage; restricted-role limitations |
| PRD-01 automations | Compare UE/CS entries with native deployments for the same record type | Script/deployment identities and role visibility, including unavailable sources |
| PRD-01 install | Load the candidate unpacked in a clean Chrome profile | Version and actual permission prompt review |
| PRD-02 SuiteQL | Run a bounded read-only query, then a uniquely ordered paged query; cancel between pages | N/query promise availability, mapped aliases, stable paging behavior and role/schema errors |
| PRD-02 metadata | Compare index identifiers with the role's Records Catalog | Validated columns/joins and explicit missing coverage; no account-wide completeness claim |
| PRD-02 exports | Import a snippet in another installed profile; open non-ASCII CSV in Excel and Sheets | Successful profile round trip and intact characters/cells in both applications |
| PRD-03 tree/compare | Compare native SO/fulfillment/invoice/payment links; compare another record of the same type | Relationship/payment semantics, returned XML identity and custom-record type isolation |
| PRD-03 RESTlets | Compare discovery with deployments; test GET and explicitly confirmed POST on a sandbox test deployment | Actual session/auth/redirect/status behavior; never send production writes for verification |
| PRD-03 logs | Compare latest rows with native logs | Script references, role visibility, time zone, order and first-1,000-row latency; deployment metadata stays unavailable until verified |
| PRD-04 sources | Explicitly read one script, active PDF editor and supplied saved-search definition | Installed-adapter acquisition, source identity/link round trips and restricted-role failure paths; no saved search execution |
| PRD-04 discovery/index | Discover scripts, scan, repeat unchanged inventory, modify a controlled test file, then Refresh | Read/skip counts, timestamps/size, changed-file reread, uncached/cached timing and throttling observations; disclose caps/exclusions |
| PRD-04 new definitions | Validate workflow/form/sourcing metadata before adding a source | Real columns/API and identity, bounded read-only transport, fixture/mapper tests and clear not-checked failures |
| PRD-05 providers | With a maintainer-supplied key, review each payload before an explicit test send | Provider/model/endpoint/limits, stream/cancel behavior, redaction review and no automatic record values |
| PRD-05 export | Compare exported fields and relationships with verified definitions | Exact list-source identity, confirmed related custom record references and requested-type coverage |
| PRD-06 MCP | Request sandbox schema from Claude Code; approve in extension, then test revoke/expiry/default production denial | Redacted client/approval transcript, per-read authorization and role/File Cabinet limits |
| PRD-06 platforms | Register/connect/uninstall through real Chrome on each advertised OS | Native-host integration proof per macOS/Linux/Windows; Node fixture transport is insufficient |
| PRD-06 publication | Follow the [release checklist](../launch/release-checklist.md) | Live docs/privacy URLs, fresh npm registry install, approved store/public install and beta feedback |

For every completed live check, record date, candidate version/commit, environment, role, action,
expected versus observed result and limitations. Keep credentials, customer/transaction values,
raw source, signed download URLs and error payloads out of committed evidence. Use fabricated
data for screenshots and regression fixtures. Update only the acceptance item the evidence proves.

## API investigation for the next source slice

The current adapter sources do not expose workflow actions/conditions, custom-form layouts or
custom-field sourcing/filtering definitions. Automation Map workflow rows and visible page field
labels do not establish those definitions. Saved-search page discovery is already implemented;
account-wide discovery/pagination remains separate from its live validation.

Oracle's [metadata extraction example](https://blogs.oracle.com/developers/extracting-netsuite-records-metadata)
documents custom-field list/record mapping through CustomField and ScriptRecordType. It also
describes mismatched display names and unavailable custom-form application metadata. This is a
candidate path for PRD-05 list-source identifiers, not proof of field sourcing/filter rules or
workflow/form definition coverage. Validate the relevant fields and joins in the active account's
Records Catalog before implementing it; preserve unknown or ambiguous mappings.

[Field.getSelectOptions](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4834781098.html)
returns option values/text rather than the record-type identifier needed for a metadata-only
list-source relationship. Do not export option rows or infer related custom records from them.

## Manual metadata probe and implemented slice (2026-10-06)

The user supplied Console screenshots and result tables from the sandbox under the previously
reported Administrator role. Standalone custom-field/source-label and record-type/name reads
succeeded. Direct custom-record lookup matched four supplied source IDs, while three positive
IDs returned no custom record. One source label matched both a custom-list key and a standard
record key. The combined display-name join failed with an unsupported-search error. These
observations establish a bounded candidate mapping path, not complete source identity or access
under a restricted role. No client field names or raw result payloads are copied into fixtures.

ADR 0045 implements separate, parameterized reads for active custom body/column fields, explicit
mapping provenance and unresolved states in Context Export. Integrated installed-extension
queries remain unvalidated. Reload the candidate extension and NetSuite page, open a record
with known custom selects, generate the export and compare identifiers/status/basis with native
field definitions. Confirm that the export retains unresolved ambiguous/custom-list cases,
contains no record values, and gives a limitation on restricted metadata access. Record the
candidate version/commit and role before closing the live gate. Workflow/form/sourcing and
record-specific related-custom-record gaps remain open.

Local slice validation: `pnpm verify` passed (109 unit files, 824 tests, five MCP tests,
lint/typecheck, docs and production build). `pnpm test:e2e` passed 73 cases with one
intentional media-capture skip, including light/dark downloads that preserve ambiguous
source status without selecting an identifier. `git diff --check` passed. These checks
use fabricated metadata and do not close the integrated live-account gate.

## Outgoing custom record relationships (2026-10-06)

Context Export schema version 2 groups outgoing references from active fields whose list
source resolved by an exact custom-record ID match. Each target carries body field or
sublist/field provenance. The account-visible custom record index is separate; name-only
and ambiguous mappings do not establish relationships. Incoming references, non-active
fields and complete target schemas remain unchecked. This adds no account queries.
Installed-adapter/native-definition comparison remains pending alongside ADR 0045 validation.

Local relationship-slice validation: `pnpm verify` passed (109 unit files, 825 tests,
five MCP tests, lint/typecheck, 12-page docs build and production extension build).
`pnpm test:e2e` passed 73 cases with one intentional media-capture skip, including
light/dark exports that keep ambiguous sources outside the related-record section.
`git diff --check` passed. These are local/fixture results, not live relationship proof.

## Selected custom record identifiers (2026-10-06)

ADR 0047 exports exact selected-type custrecord_ identifiers from existing custom-definition
metadata in a separate Markdown/JSON section, even without an open record of that type.
The section is partial, or not-checked when no identifiers return; it does not populate
body/sublist fields, infer relationships or establish a complete schema. The existing join,
role coverage and installed-adapter reads still need live verification. Standard non-active
types and full field attributes remain pending.

Local selected-type slice validation: `pnpm verify` passed (109 unit files, 828 tests,
five MCP tests, lint/typecheck, 12-page docs and production build). `pnpm test:e2e`
passed 73 cases with one intentional media-capture skip. Light/dark exports include
selected custom-record identifiers with partial coverage and empty active body/sublist
fields for a non-active type. `git diff --check` passed. These fixture checks do not
validate the metadata join or restricted-role access in an account.
