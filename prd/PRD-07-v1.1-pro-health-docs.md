# PRD-07 — v1.1 Pro: Account Health Scan, Documentation Generator, Licensing

| | |
| --- | --- |
| Status | Preparatory implementation authorized; Pro entry and live gates pending |
| Target | Apr–Jun 2027 (6–8 weeks) |
| Tier | Pro (with a summary version in Community) |
| Depends on | v0.4 (impact), v0.5 (AI), v1.0 |
| Entry gate | ≥ 300 WAU and ≥ 1 services client sourced from the extension |

The user authorized preparatory work on October 6, 2026: plan the implementation and start
one-record as-built previews using existing Context Export metadata. This does not establish
300 WAU, a services client, public-launch readiness or authorization to enable monetization.
PRD-01–06 live and external gates remain open. Keep the preview opt-in; Community features
remain available independently of licensing. Do not change candidate release versions yet.

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

## 8. Implementation order and source boundaries

### A. Documentation Generator — first bounded slice

- [x] F-7.5/F-7.9 partial: opt-in Community as-built preview for one active or typed record type,
  generated locally from the existing metadata-only Context Export model; empty/loading/error,
  cancel/retry, input validation, page/account invalidation and Safe mode support.
- [x] Verify fixture metadata/value exclusion and light/dark browser behavior for this slice
  (ADR 0048; [local evidence](../docs/validation/prd07-as-built.md)).
- [ ] Validate the draft against native sandbox definitions; fixture success is not account proof.
- [ ] Extend forms, related saved searches and RESTlet relationships only after validating their
  source identity, role visibility and record-type relationship. Keep unavailable sections not checked.
- [ ] F-7.6: document export implementation and Word/Google Docs acceptance (Pro release gate applies).
- [ ] F-7.8/F-7.9: handover/change-request templates and multiple record types after one-type preview.
- [ ] F-7.7: optional previewed BYOK narrative, clearly labelled AI-written, after deterministic metadata output.

| Document section | Initial evidence | Limit |
| --- | --- | --- |
| Overview | Requested record type and generation date | Partial draft; no business-process narrative |
| Fields/sublists | Context Export active snapshot; selected custom definition identifiers | No values; selected definitions do not establish full schema or form layout |
| Custom record references | Exact active-field custom-record source ID matches | Outgoing only; incoming and absent fields unchecked |
| Scripts/deployments/workflows | Existing adapter metadata | No exact runtime execution order or field interaction proof |
| Forms/searches/integrations | No validated record-specific source in the model | Explicitly not checked; no extra discovery queries |
| Risk notes | Coverage limitations | No score, safety verdict or account-specific risk findings |

### B. Health Scan — after source validation

- [ ] Inventory candidate checks and validate script version, deployed/inactive status and log-level
  metadata against native sandbox definitions before adding a finding rule.
- [ ] F-7.1: explicit bounded scan plan, per-account progress, cancel/pause/resume and timestamps.
- [ ] F-7.2: deterministic findings from validated metadata with evidence, explanation and links;
  unknown/unavailable coverage remains distinct from passing checks.
- [ ] Define category score semantics and denominators before showing scores. Impact candidates
  cannot establish unused fields, absent automation conflicts or safe deletion.
- [ ] F-7.3/F-7.4: Community summary/top-five and optional services CTA; Pro history/comparison/export
  follows the entry gate and licensing implementation.
- [ ] Validate each added check with fixtures and a sandbox; do not infer role/security coverage.

### C. Commercial release — deferred until entry gate evidence

- [ ] Record ≥300 WAU and ≥1 services client with an approved measurement method; existing local
  opt-in counters cannot establish WAU. Confirm inherited PRD-06 public release gates.
- [ ] F-7.10: select a licensing/payment provider after verifying maintainer-country support.
- [ ] F-7.11/F-7.12: test trial, activation, local cached status and seven-day offline grace;
  Community features must not depend on a licensing request.
- [ ] F-7.13: publish pricing only after commercial choices are confirmed.
- [ ] F-7.14/F-7.15: hosted AI stays deferred; introducing a proxy needs a separate security/privacy
  decision and explicit approval. BYOK remains available.
