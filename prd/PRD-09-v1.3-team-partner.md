# PRD-09 — v1.3 Team / Partner Edition

| | |
| --- | --- |
| Status | Draft |
| Target | September 2027 (4–6 weeks) |
| Tier | Team/Partner |
| Depends on | v1.1, v1.2 |

## 1. Goal

Make SuiteLens the standard way of working for implementation teams (small and mid-sized partners and in-house teams),
and open a partner channel for services and subcontracting.

## 2. Functional requirements

- F-9.1 **Team workspace:** admins invite members by email; per-seat licensing.
- F-9.2 **Shared library:** SuiteQL snippets, RESTlet collections, log filter presets, document templates and custom Health Scan rules shared with the team. Only these assets sync — never NetSuite account data.
- F-9.3 **Branded output:** partner logo, colors, header/footer on documents and reports.
- F-9.4 **Client registry:** list of client accounts (account ID, label, environment colors) shareable with team members; no credentials stored.
- F-9.5 **Team standards:** cutover checklists, field/script naming conventions, simple SuiteScript lint rules run in the Health Scan.
- F-9.6 **Managed deployment:** Chrome Enterprise policy support (configuration through managed storage) for companies.
- F-9.7 **Private builds / declarative plugins:** JSON packages (snippets, presets, templates, rules) installable as "plugins" with no code; for custom logic, use the client's own Bridge RESTlet.
- F-9.8 Simple admin dashboard: members, seats, aggregated feature usage (opt-in).

## 3. Non-functional requirements

- NF-9.1 Minimal sync backend (auth + team asset storage), encrypted in transit and at rest.
- NF-9.2 No NetSuite record data is ever synced.
- NF-9.3 Full export of all team assets (no lock-in).

## 4. Acceptance criteria

- [ ] A snippet shared by an admin appears for every member in < 1 minute.
- [ ] Documents from the Doc Generator use the partner's logo.
- [ ] Chrome Enterprise policy can set environment colors and disable AI features.

## 5. Commercial model

Monthly/annual per-seat pricing; discounts for partners who refer services work; a "Partner Program"
bundle: team licenses + co-marketing + subcontracting.
