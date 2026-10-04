# PRD-07 — v1.1 Pro: Account Health Scan, Documentation Generator, Licensing

| | |
| --- | --- |
| Status | Draft |
| Target | Apr–Jun 2027 (6–8 weeks) |
| Tier | Pro (with a summary version in Community) |
| Depends on | v0.4 (impact), v0.5 (AI), v1.0 |
| Entry gate | ≥ 300 WAU and ≥ 1 services client sourced from the extension |

## 1. Goal

Open the first revenue stream with features that produce **outputs to send to other people**
(reports, documents), while doubling as a diagnostic tool for audit services.

## 2. Account Health Scan

### Checks (shipped incrementally)
| Category | Example checks |
| --- | --- |
| Code | SuiteScript 1.0 vs 2.x inventory; scripts without active deployments; deployments logging at DEBUG in production |
| Automation | Many UEs on one record type; workflows and scripts touching the same field; "testing" workflows in production |
| Data model | Custom fields with no references (from Impact Analysis); custom records with no data (VERIFY) |
| Searches | Large/heavy public saved searches; searches used on dashboards (VERIFY source) |
| Security | Roles with broad permissions; RESTlets/Suitelets without role restrictions (VERIFY) |

### Requirements
- F-7.1 Incremental, pausable scan with progress; results per account with a timestamp.
- F-7.2 Score per category + findings list (severity, explanation, how to fix, object link).
- F-7.3 Community: score summary + top 5 findings. Pro: all findings, PDF/Markdown/CSV export, scan history, scan-to-scan comparison.
- F-7.4 Subtle "Get help fixing this" CTA → services page (can be switched off).

## 3. Documentation Generator

- F-7.5 Pick a record type → generate a **Technical Design / As-built document**: overview, custom fields (table), sublists, forms, scripts & deployments (execution order), workflows, related saved searches, integrations (RESTlets), risk notes.
- F-7.6 Formats: Markdown and DOCX.
- F-7.7 Optional AI (BYOK/hosted) to write the "what this automation does" narrative; always marked as AI-written.
- F-7.8 Selectable templates (as-built, handover, change request).
- F-7.9 Community: on-screen preview. Pro: export, templates, multiple record types at once.

## 4. Licensing & payments

- F-7.10 `licensing` module with a swappable provider (ExtensionPay / Paddle / Lemon Squeezy). Prefer a **merchant of record** so global sales tax/VAT is handled; VERIFY provider support for the maintainer's country.
- F-7.11 14-day Pro trial, no credit card required.
- F-7.12 License status cached locally; Community features never call the licensing server; if the server is down, Pro keeps working through a 7-day grace period.
- F-7.13 Pricing page on the website with a feature comparison; regional pricing (purchasing-power parity) considered at launch.

## 5. Hosted AI (optional in v1.1)

- F-7.14 Monthly AI quota for Pro users without BYOK, through a minimal proxy (no prompt storage; logs contain cost metadata only).
- F-7.15 If not ready, defer to v1.2; BYOK remains available.

## 6. Acceptance criteria

- [ ] Health Scan finds 1.0 scripts and DEBUG deployments in fixtures and a test account.
- [ ] PDF/Markdown export of scan reports works for Pro; Community sees the summary.
- [ ] Doc Generator produces a DOCX that opens cleanly in Word and Google Docs.
- [ ] Trial → payment → activation works end to end in the provider's test mode.
- [ ] Going offline does not break Community features.

## 7. Metrics

Trial-to-paid conversion, number of exported reports, services leads from the Health Scan CTA.
