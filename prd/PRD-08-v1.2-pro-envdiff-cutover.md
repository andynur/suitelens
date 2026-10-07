# PRD-08 — v1.2 Pro: Environment Diff & Cutover/SDF Builder

| | |
| --- | --- |
| Status | Draft |
| Target | Jul–Aug 2027 (6–8 weeks) |
| Tier | Pro |
| Depends on | v0.2 (metadata), v0.4 (dependencies), v1.1 (licensing) |
| Entry gate | First paying Pro customer |

## 1. Goal

Offer a lightweight alternative for environment comparison and deployment preparation, which today is
only available in enterprise tools, for freelance consultants and small partners.

## 2. Environment Diff

### Concept
The user is logged in to two accounts (e.g. sandbox and production) in two tabs. The extension takes a
**metadata snapshot** from each tab using that tab's session, then compares them locally.

### Requirements
- F-8.1 Pick source and target accounts from open NetSuite tabs; show the environment clearly.
- F-8.2 Selectable scope: custom fields (body/column/entity/item/custom record), custom record types, scripts & deployments, workflows (basic metadata), saved searches (basic metadata), roles (permissions), forms (VERIFY), script files (content hash).
- F-8.3 Results: only in source / only in target / different (attribute diff; text diff for script files).
- F-8.4 Filters, search, diff report export (Markdown/CSV/PDF).
- F-8.5 Snapshots can be saved and compared later (e.g. "before vs after release").
- F-8.6 Optional: the user's own Bridge RESTlet for large snapshots (open-source RESTlet code in `packages/suitescript`).

## 3. Cutover / SDF Builder

- F-8.7 Deployment cart: add objects while browsing ("Add to cutover" in Field Explorer, Automation Map and Diff results).
- F-8.8 Dependency resolution: suggest related objects (fields used by scripts, imported libraries, referenced lists/records) with confidence levels.
- F-8.9 Export: script ID list for SuiteCloud CLI `object:import`, a `deploy.xml`/`manifest.xml` skeleton (VERIFY current structure), and a cutover checklist (Markdown/CSV) including manual steps for objects SDF doesn't support.
- F-8.10 Flags for objects known to be unsupported by SDF or needing manual steps (list maintained in the repo).
- F-8.11 Deployment runbook template (pre-checks, order, post-deploy verification, rollback).

## 4. Non-functional requirements

- NF-8.1 Snapshots and diffs are fully local; no account data is sent to a server.
- NF-8.2 Diffing 2,000 objects finishes in < 30 s once snapshots exist.
- NF-8.3 The extension never deploys directly; outputs are artifacts for SDF/CLI.

## 5. Acceptance criteria

- [ ] A custom field that exists only in sandbox appears under "only in source".
- [ ] Script file content changes are detected and a text diff is shown.
- [ ] The cutover cart produces a checklist and an object list usable with `object:import` in a test SDF project.
- [ ] Data from the two accounts stays separate and clearly labeled on every screen.

## 6. Risks

- Permission differences between the two accounts produce false diffs → show what was readable per account.
- SDF file structures may change per release → mark the tested version and update the docs each release.
