# Features and coverage

SuiteLens for NetSuite is a free, open-source side panel for developers, admins and consultants.

- **Record:** explore body/sublist fields, IDs, types, flags and rendered values; literal search highlights and copy helpers.
- **Automation:** role-visible client/user-event/workflow-action scripts and workflows with metadata limitations.
- **SuiteQL:** a guarded SELECT/WITH console, parameters, drafts, snippets, partial catalog, paging and local exports.
- **Inspector:** saved XML/JSON, masking, same-type comparison and bounded related-transaction exploration.
- **RESTlets:** explicit session requests with named confirmations and a separate production-write guard.
- **Impact (where used):** possible references in planned sources; unsupported/unread sources remain unchecked. It never proves account-wide runtime usage or absence.
- **Logs:** bounded ScriptNote reads, local filters and error groups; role visibility applies.
- **AI:** optional BYOK providers, editable/redactable previews, script/error explanation and SQL drafts; AI does not automatically execute SQL.
- **AI Context:** metadata-only exports for coding agents, generated through the adapter.
- **Local MCP:** optional read-only local agent access, one-hour account/session approval, production off by default, activity metadata and revocation.
- **Workspace:** tabs ordered for developers, administrators or functional consultants; tabs that do not fit go to a More menu. Open the panel in a full browser tab from the header.
- **Settings:** feature toggles, safe mode, themes, account environment colors, onboarding replay, local opt-in counters and deletion controls.

Live behavior depends on NetSuite account catalog and role permissions. Fixture/unit tests establish
local behavior, not account-wide visibility or a guarantee that every source can be read.
