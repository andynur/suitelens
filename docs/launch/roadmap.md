# Public roadmap

The implemented workbench covers record exploration, automation metadata, a read-only SuiteQL
console, inspector/RESTlet/log tooling, bounded change-impact candidates and optional AI Assist.
PRD-06 adds hardening, onboarding, documentation and a local read-only MCP bridge.

Remaining product coverage includes workflow/form/field-sourcing definitions and verified risk
metadata in Impact Analysis, plus list-source identifiers and incoming custom record
relationships and live validation of outgoing references in Context Export. Metadata indexing
and fields for selected record types are partial. Selected custom types expose available
definition identifiers separately from active fields. Fixture-tested features still require
the sandbox/manual acceptance recorded in PRD-01–05.

Public launch is pending these external gates:

- sandbox verification through Claude Code with real account approval;
- platform verification of native registration and Chrome IPC on supported OSes;
- publication and fresh installation of the npm bridge;
- docs hosting and live privacy URL;
- configured security/services/sponsor contact information;
- approved Chrome Web Store listing and public installation;
- beta feedback from 10–20 consultants, followed by the launch article/demo.

See the repository's PRD-06 checklist for evidence. Dates and completion claims are updated only
when the corresponding external gate has actually passed. Future paid/enterprise ideas are outside
this community release and are not promises of availability.
