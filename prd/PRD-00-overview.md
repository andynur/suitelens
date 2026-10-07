# PRD-00 — Product Overview: SuiteLens for NetSuite

| | |
| --- | --- |
| Status | Draft v1 |
| Date | October 4, 2026 |
| Owner | Maintainer (Product + Engineering) |
| Scope | Vision, personas, principles, business model, cross-version metrics |
| Slug | `netsuite-suitelens` |

## 1. Summary

SuiteLens is a free, open-source developer workbench for NetSuite, delivered as a Chrome extension.
Its focus is not just "seeing what is inside a record" but **change & context**: understanding everything
a record is connected to, what breaks when something changes, how to move changes between environments,
and giving AI the right account-specific context.

## 2. Problem

1. Developers and consultants jump between the Records Browser, Scripted Records, saved searches and the
   execution log to answer simple questions ("which scripts run on this record?").
2. The impact of changing a field or script is invisible until something breaks in production.
3. Sandbox vs production comparison and cutover planning are still manual (spreadsheets), while
   enterprise tools cost tens of thousands of dollars per year.
4. AI coding assistants write SuiteScript with wrong field IDs and structures because they do not know the account's schema.
5. Existing free extensions are good utilities, but fragmented, and some are limited by daily quotas.

## 3. Vision

> "Every NetSuite developer can understand, change and move customizations with confidence,
> right from the browser, without heavy installs."

## 4. Personas

| Persona | Description | Jobs to be done | Main pain |
| --- | --- | --- | --- |
| **Dana — SuiteScript Developer** | 2–6 years of experience, writes UE/CS/MR scripts, debugs often | Find field IDs, know which scripts run, test SuiteQL and RESTlets | Context is scattered; AI gets field IDs wrong |
| **Ryan — Freelance/Partner Consultant** | Works across 3–10 client accounts | Understand a new client account fast, document it, deploy safely | Slow account onboarding, manual documentation, wrong-environment mistakes |
| **Sam — In-house NetSuite Admin** | The only admin at a mid-sized company | Change fields/forms without breaking processes, audit customizations | Afraid to change fields that are used elsewhere |
| **Partner Lead** | Leads an implementation team of 5–30 people | Standardize the team's way of working and documentation | Inconsistent handover quality |

## 5. Product principles

1. **Free with no quotas for everything that runs locally against a single account.**
2. **Read-only and safe by default.**
3. **Data stays in the browser** unless the user explicitly chooses otherwise.
4. **Automatic context:** the extension knows which record you are on; you never retype it.
5. **Keyboard-first** for power users, while staying friendly for admins.
6. **Honest about limits:** when NetSuite does not allow something, explain why.
7. **Open source** as a guarantee of trust.

## 6. Version map

| Version | Theme | PRD | Tier |
| --- | --- | --- | --- |
| v0.1 | MVP Foundation | PRD-01 | Community |
| v0.2 | SuiteQL Console | PRD-02 | Community |
| v0.3 | Dev Toolbox | PRD-03 | Community |
| v0.4 | Impact Analysis | PRD-04 | Community (per object) |
| v0.5 | AI Assist (BYOK) + AI Context | PRD-05 | Community |
| v1.0 | Public launch + MCP bridge | PRD-06 | Community |
| v1.1 | Health Scan + Doc Generator + Licensing | PRD-07 | Pro |
| v1.2 | Environment Diff + Cutover/SDF Builder | PRD-08 | Pro |
| v1.3 | Team/Partner | PRD-09 | Team |
| Backlog | Future ideas | PRD-10 | Various |

## 7. Business model

**Open core + productized services.**

| Tier | Includes | Indicative price |
| --- | --- | --- |
| Community | Every local, single-account feature, no quotas, open source | Free |
| Pro | Cross-account diff, full Health Scan, Documentation Generator, Cutover Builder, report exports, limited hosted AI | $6–9/month or $60–80/year |
| Team/Partner | Pro + shared snippets/presets, branded templates, seat licensing, priority support | $10–15/seat/month |
| Enterprise / Private build | Private build, custom features, SLA | Contract |

Gating rule: lock **outputs** (reports, exports, documents, cross-account work), never **on-screen insight**.
Safety features (Environment Guard, read-only mode) are never locked.

Services driven by the product: Account Health Audit, AI/MCP Enablement, SDF & CI/CD setup,
SuiteScript 1.0 modernization, custom plugins/private builds, team training.

## 8. Success metrics

| Metric | Definition | 12-month target |
| --- | --- | --- |
| WAU | Weekly active users (counted locally, opt-in telemetry) | 500–1,000 |
| Activation | % of installs that open the side panel on a record page within 7 days | ≥ 60% |
| M1 retention | % of users active again after 30 days | ≥ 35% |
| Store rating | Average stars | ≥ 4.7 |
| Service leads | Service requests that came from the extension or website | 2–4 per quarter |
| Pro conversion | % of WAU subscribed (from v1.1) | 1–3% |

## 9. Non-goals (whole product)

- Not a replacement for an IDE or SDF.
- Not a tool for everyday finance end users (focus: developers, admins, consultants).
- Will never sell or monetize user data.
- Never bypasses NetSuite permissions; always follows the user's role.

## 10. Key assumptions & risks

| Assumption / risk | Mitigation |
| --- | --- |
| `require` and `N/*` modules are available on most NetSuite UI pages | Detect availability; fall back to record XML or a clear message |
| SuiteQL table/column names for metadata may change | Centralized queries + VERIFY tags + fixtures + error monitoring |
| Oracle ships similar features | Focus on cross-account and consultant workflows; integrate with Oracle, don't fight it |
| Competitors copy features | Release speed, open source, close community ties |
| Limited account access for development | FixtureAdapter, beta-tester program, SuiteCloud Developer Network |
