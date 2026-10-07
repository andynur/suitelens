# ADR 0019 — Local command palette and pending console drafts

Status: accepted

Ctrl/Cmd+K in the side panel opens a local command palette with searchable enabled features,
account-local saved snippets and bundled examples. Arrow keys select commands; Enter activates
one; Escape closes the palette. The combobox owns focus and uses listbox active-descendant
semantics. Closing restores focus to the invoking control, or the selected tab when the old
control is hidden or an inactive tab. Restoring focus to an inactive Radix tab would reactivate
it, so that path is explicitly excluded. The header exposes a Commands button and Settings
can disable the palette. Quick Go-to retains its own button and receives Ctrl/Cmd+K when the
palette is disabled. The global extension open-goto command keeps its existing behavior.

`record <mapped type> <internal ID>`, `record transaction <internal ID>`,
`record customrecord <record type ID> <internal ID>` and `script <internal ID>` use existing
validated same-account URL builders. Script IDs must be numeric internal IDs; arbitrary URLs
and script-ID resolution are not guessed. Navigation opens a browser tab and performs no
NetSuite data reads or writes. Existing URL compatibility caveats still apply.

Snippets open as new console drafts with their parameter definitions, without executing SQL.
The mounted Console subscribes to the account-scoped pending draft state and reconciles drafts
queued before its asynchronous workspace load. The editor waits for a free tab at the 20-tab
limit instead of replacing another draft. Mismatched-account drafts are never consumed. Draft
SQL uses the existing local workspace persistence; parameter state remains in panel memory.

Browser preferences used by the fixture adapter are injected from shared/adapter, matching the
content-service dependency boundary and keeping browser storage outside the NetSuite module.
