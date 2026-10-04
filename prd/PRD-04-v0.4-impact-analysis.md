# PRD-04 — v0.4 Impact Analysis ("Where Used")

| | |
| --- | --- |
| Status | Draft |
| Target | Jan–Feb 2027 (4–5 weeks) |
| Tier | Community for a single field/object; account-wide reports & exports = Pro (v1.1) |
| Depends on | v0.2 (metadata indexer), v0.3 |

## 1. Goal

Before changing or deleting a field, script or saved search, users can see **everywhere that object is used**.
This is the first differentiator: no free extension does this today without installing a SuiteApp.

## 2. User stories

| ID | As a | I want to | So that |
| --- | --- | --- | --- |
| US-4.1 | Admin | know which saved searches, workflows, scripts, forms and PDF templates use `custbody_x` | I can change or delete it safely |
| US-4.2 | Developer | know which script files reference a given field ID | I can refactor with confidence |
| US-4.3 | Consultant | get a "change risk" summary for one field | I can explain the impact to my client |
| US-4.4 | Developer | know which libraries a script imports | I understand code dependencies |

## 3. "Where used" sources (prioritized)

| Source | Method | Confidence |
| --- | --- | --- |
| Script files in the File Cabinet | Download file content (same-origin), search for field/script ID strings, cache by file hash | High for string literals; low for dynamically built IDs |
| Saved searches | Criteria/column/formula metadata (VERIFY source: search definitions or System Notes) | Medium |
| Workflows | State/action/condition definitions (VERIFY source) | Medium |
| Custom forms & field layout | Form metadata (VERIFY) | Medium |
| Advanced PDF/HTML templates | Template content (search for `${record.fieldid}`) | High |
| Sourcing/filtering on other custom fields | Custom field metadata | Medium |

Every result must state its **confidence level** (certain / possible / could not be checked) and its
**source**. Sources that cannot be read because of permissions are shown as "not checked".

## 4. Functional requirements

- F-4.1 Entry points: a "Where used" action in Field Explorer, the Automation Map, and free input (field ID / script ID / saved search ID).
- F-4.2 Incremental scan with progress per source; cancellable; results cached per account with a timestamp.
- F-4.3 Results grouped by source: object name, type, location (code line / criterion / action), link.
- F-4.4 Code excerpts (±3 lines) for script-file hits.
- F-4.5 Risk summary: reference counts per type, whether used in active scripts, released workflows or public saved searches.
- F-4.6 Simple **script dependency list:** script → imported libraries (`define([...])`), shown as a nested list.
- F-4.7 Incremental script content index: only changed files (by modified date/size) are rescanned.
- F-4.8 Community: on-screen results. Pro (later): report export, scan all custom fields at once, "unused fields" report.

## 5. Non-functional requirements

- NF-4.1 Scanning one field in an account with 500 script files finishes in < 60 s after the initial index; < 5 s from cache.
- NF-4.2 Rate limiting so NetSuite throttling is never triggered.
- NF-4.3 Script content is stored locally only as an index (tokens/positions), with a "don't store content" option.

## 6. Acceptance criteria

- [ ] For a custom field used in 1 UE script, 1 saved search and 1 PDF template (fixtures), all three are found with the right sources and links.
- [ ] Dynamically built references (`'custbody_' + x`) are never reported as certain.
- [ ] Sources that fail due to permissions appear as "not checked" with a reason.
- [ ] A scan can be cancelled and resumed without starting over.

## 7. Risks

- API access to workflow/saved search/form definitions may be limited. Ship incrementally: start with script files + PDF templates (high confidence), add other sources once verified.
- False negatives can make users overconfident. Show a coverage disclaimer on every result.
