# PRD-10 — Backlog & Future Ideas

These ideas are not scheduled yet. Scoring: **Impact** (1–5) for developers/consultants,
**Effort** (1–5, higher is heavier) for a single developer, **Priority** = Impact × (6 − Effort).
Review the backlog every quarter based on user feedback.

## 1. Summary table

| # | Idea | Impact | Effort | Priority | Tier | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| B-01 | Advanced PDF Studio | 4 | 3 | 12 | Community + Pro snippets | Split editor, data XML explorer, `${record.*}` autocomplete, preview |
| B-02 | Error Triage & Digest | 4 | 4 | 8 | Pro | Error grouping, AI summary, history beyond 30/60 days, email digest via RESTlet/server |
| B-03 | SuiteScript 1.0 → 2.1 Migration Assistant | 4 | 3 | 12 | Pro + services | Inventory, API mapping, AI draft conversion, test checklist |
| B-04 | Role & Permission Compare | 3 | 2 | 12 | Community | Compare two roles; find roles holding a permission |
| B-05 | Workflow Visualizer | 4 | 4 | 8 | Community | Draw workflow states and transitions (VERIFY definition source) |
| B-06 | Governance Profiler | 3 | 4 | 6 | Pro | Static analysis of expensive patterns (load in loops, unfiltered searches) |
| B-07 | Saved Search Tools | 3 | 2 | 12 | Community | Export to SuiteQL/SS2.1, result preview, field search in dropdowns |
| B-08 | Sublist Grid | 3 | 2 | 12 | Community | Sublists as tables with sort/filter/export |
| B-09 | Cross-account Record Compare | 3 | 3 | 9 | Pro | One record in sandbox vs production |
| B-10 | Release Preview Checklist | 4 | 3 | 12 | Pro + services | Risky scripts/features per release, test notes, report |
| B-11 | Custom MCP Tool Templates | 4 | 2 | 16 | Community + services | Custom Tool Script templates for Oracle's official AI Connector Service |
| B-12 | CSV Import Helper | 3 | 3 | 9 | Community | Validate files before import, field ID mapping, read error results |
| B-13 | Translation/i18n Field Audit | 2 | 2 | 8 | Community | Check labels and translations of custom fields |
| B-14 | Integration Inspector | 3 | 3 | 9 | Pro | Integration records, token roles, RESTlets called (VERIFY) |
| B-15 | Community Snippet Library | 3 | 4 | 6 | Community | Curated GitHub repo of SuiteQL snippets and templates |
| B-16 | Firefox & Edge builds | 3 | 2 | 12 | Community | WXT makes multi-browser builds straightforward |
| B-17 | Account Tour (client onboarding report) | 4 | 3 | 12 | Pro | One-page report: enabled features, customization counts, integrations, risk areas |
| B-18 | Regional localization packs | 3 | 3 | 9 | Services | Document templates and checklists for country-specific requirements (tax, statutory reporting), validated with local practitioners |
| B-19 | Unit Test Scaffolder | 3 | 3 | 9 | Community | Generate Jest test skeletons + `N/*` mocks from the open script |
| B-20 | Screen-share / Demo Mode | 3 | 1 | 15 | Community | Mask sensitive values across all views while presenting |
| B-21 | Field Usage Statistics | 3 | 3 | 9 | Pro | % of records that populate each custom field (aggregate SuiteQL) |
| B-22 | Lightweight Change Log | 3 | 3 | 9 | Pro | Record metadata changes between snapshots; link to tickets |
| B-23 | UI translations (community) | 2 | 2 | 8 | Community | Community-contributed locales once the English UI is stable |

## 2. Top ideas in detail

### B-11 Custom MCP Tool Templates (highest priority)
- Problem: companies want Oracle's official AI Connector Service, but need custom tools beyond the standard ones.
- Solution: a template generator for Custom Tool Scripts (SuiteScript) + an SDF project + documentation, with security patterns (input validation, roles, logging).
- Monetization: templates are free; implementation is sold as the "AI/MCP Enablement" service.

### B-20 Screen-share / Demo Mode
- Problem: consultants often present to clients or record tutorials.
- Solution: one toggle that masks emails, names, amounts and selected fields across the extension UI (and optionally on the page).
- Cheap to build, immediately useful, and great for marketing content.

### B-01 Advanced PDF Studio
- Problem: building Advanced PDF/HTML templates involves a lot of guesswork.
- Solution: split editor with sample record XML, field autocomplete, FreeMarker snippets (sublist loops, currency formatting, barcodes), fast preview.
- Note: the preview still relies on NetSuite's renderer (VERIFY how to trigger a preview from the extension).

### B-17 Account Tour
- Problem: the first day on a new client account goes into orientation.
- Solution: an automatic one-page report: enabled features, script counts by type, most customized record types, integrations, early risks.
- A natural entry point for audit services.

## 3. Ideas deliberately rejected (for now)

| Idea | Reason |
| --- | --- |
| Running free-form SuiteScript in the browser | Security and Web Store review risk; reconsider later via `chrome.userScripts` with opt-in |
| Deploying straight to production from the extension | High risk; leave it to SDF/CLI |
| Bulk data scraping for exports | May violate policies and overload accounts; use capped SuiteQL |
| Storing credentials for auto-login | Violates the security principles |
