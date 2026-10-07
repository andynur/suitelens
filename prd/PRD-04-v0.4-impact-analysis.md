# PRD-04 — v0.4 Impact Analysis ("Where Used")

| | |
| --- | --- |
| Status | Partially implemented; source coverage, risk metadata and live validation pending |
| Target | Jan–Feb 2027 (4–5 weeks) |
| Tier | Community for a single field/object; account-wide reports & exports = Pro (v1.1) |
| Depends on | v0.2 (metadata indexer), v0.3 |

Progress reconciled on October 6, 2026. Checked items establish only the evidence described
below; sandbox and external acceptance remain separate. See the
[validation matrix](../docs/validation/prd01-06-matrix.md).

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

- [x] For a custom field used in 1 UE script, 1 saved search and 1 PDF template (fixtures), all three are found with the right sources and links. File links target observed downloaded source, not verified object/editor pages (ADR 0035).
- [x] Dynamically built references (`'custbody_' + x`) are never reported as certain (fixture tests).
- [x] Sources that fail due to permissions appear as "not checked" with a reason (fixture tests).
- [x] A scan can be cancelled and resumed without starting over (fixture tests).

## 7. Risks

- API access to workflow/saved search/form definitions may be limited. Ship incrementally: start with script files + PDF templates (high confidence), add other sources once verified.
- False negatives can make users overconfident. Show a coverage disclaimer on every result.

### Implementation checklist

- [x] Local reference candidate scanner for supplied script/PDF text: exact identifier tokens,
  recognizable dynamic prefixes, source and possible confidence, one-based locations and optional
  bounded ±3-line excerpts. Fake UE/PDF fixtures and unit tests; no execution, network or persistence
  (ADR 0020). This foundation does not establish runtime usage or account coverage.
- [x] Read one linked File Cabinet script or XML PDF template export through NetSuiteAdapter;
  account/target checks, observed same-origin download links, explicit permission failures,
  timeout/streaming limits, fake fixtures and unit tests (ADR 0021). No raw source persistence.
- [x] Native sandbox source probe: script File Cabinet record exposes the accepted observed
  media-link shape and its Download action emits a browser download event; Advanced PDF
  Source Code exposes XML in `textarea#source-template` with no media download anchor.
  No save action or raw-source capture. See [probe evidence](../docs/validation/prd04-source-probe.md);
  this does not prove a SuiteLens adapter read or a persisted template's identity.
- [x] Active Advanced PDF editor snapshot through the adapter: explicit Source Code read,
  bounded XML text, account/page guards, separate editor/template identity, unsaved-customization
  label, candidate locations and observed editor-context link. Memory only; outside file plans,
  caches and summaries (ADR 0036). Unit and light/dark fixture browser coverage.
- [ ] Validate script acquisition and the PDF editor read through the installed adapter;
  validate saved custom-template identity/link round trips and restricted-role behavior.
  The native probe confirms only unsaved standard customization; existing-template guards
  have fixture evidence. Account script discovery is implemented (ADR 0031).
  Linked-file/editor reads do not establish source-category coverage.
- [x] F-4.2 backend foundation for explicitly supplied linked files: sequential reads, per-file
  progress, cancellation with late-response discard, resume from account-scoped timestamped
  checkpoints and refresh. Only candidate positions/status metadata is persisted; failed sources
  remain not checked. Fake-source tests (ADR 0023); UI coverage is recorded in the workbench slice below, while live
  adapter validation remains outstanding.
- [x] F-4.1–F-4.5 linked-file workbench slice: feature-flagged Where used tab, free identifier
  input and explicit file plan, per-source progress, cancellation/resume, checkpoint restore/refresh,
  grouped possible positions, not-checked reasons, cache warning, timestamps and coverage/risk
  limitations (ADR 0024). Fixture unit and light/dark browser coverage; no live-account claim.
- [x] F-4.1 Field Explorer (body, off-form and sublist fields) and Automation Map identifier
  shortcuts into Where used (ADR 0025). Feature-gated, page/account/adapter-scoped ephemeral
  prefill; no automatic file plan, discovery or scan. Fixture unit and light/dark browser tests.
- [x] F-4.4 linked-script excerpts: transient ±3-line context for the first 20 candidates per
  file, bounded lines with clipping disclosure, line numbers and escaped text rendering. No
  source text in checkpoints; restored/resumed files need explicit Refresh for excerpts
  (ADR 0026). Fixture unit and light/dark browser coverage; no live-account claim.
- [x] F-4.5 source-level reference summary: separate matching-object and candidate counts per
  script/PDF/saved-search source, fully checked/not-checked/pending coverage, and public/private/unknown
  saved-search visibility. Counts include partial/dynamic candidates and remain independent of filters;
  unplanned sources are not reported as zero. No activation/release or risk verdict is inferred
  (ADR 0034). Fixture unit and light/dark browser coverage; no new source access or persistence.
- [ ] Complete F-4.3/F-4.5: verified object names/links and risk summary backed by
  active/released/public source metadata.
- [x] Record-scoped script metadata for candidate files: explicit Automation Map lookup,
  script-record names/internal IDs, deduplicated enabled/inactive/unknown counts, unmatched
  file disclosure, account/page/type guards and memory-only results (ADR 0039). Fixture
  unit and light/dark browser coverage. Enabled is an inactivity flag, not runtime or
  deployment evidence; verified links and broader risk assessment remain open.
- [x] F-4.3 File Cabinet names for manual/restored file plans: explicit bounded metadata lookup
  through the existing adapter query, ID fallback, account/page/cancellation guards, retry and
  memory-only labels (ADR 0037). Unit and light/dark fixture coverage. File names are not script
  object names; object/editor link round trips and activation/release metadata remain open.
- [x] F-4.6 static script dependency list: nested top-level `define([...])` declarations and
  module literals, source locations, bounded parsing, explicit dynamic/syntax/limit reasons;
  no execution or module resolution. Fresh reads only; Refresh restores missing lists (ADR 0027).
- [x] F-4.7 local index foundation and NF-4.3 storage preference: account/adapter/file-scoped
  hashed token/position index, cross-identifier lookup, 24-hour TTL, hash comparison on Refresh,
  truncation disclosure and account opt-out with deletion (ADR 0028). No raw source persistence.
- [x] F-4.7 inventory-based script reuse: fresh discovery compares modified date and size with
  the account/adapter/file index revision, skipping unchanged source reads. Missing/changed metadata,
  legacy/expired indexes and account opt-out force reads; Refresh always rereads. Cancellation/resume
  retains its inventory-scoped checkpoint (ADR 0033). Fixture unit and light/dark browser coverage.
- [ ] Validate inventory-based skipping and establish NF-4.1/NF-4.2 performance and throttling
  behavior in an account; timestamp granularity and role visibility remain live verification gaps.
- [x] Saved-search source for explicitly supplied IDs: read-only definition via `N/search.load.promise`
  (names, joins, formulas, title, public flag; no values or results), sequential scan with
  cancel/resume, possible filter/column/formula positions, object link and public count (ADR 0029).
  Fixture unit and browser-level coverage; no live-account claim.
- [ ] Add workflow definition sources after validating a read-only API and role coverage in an account.
- [ ] Add custom-form/layout definition sources after validating a read-only API and object identity.
- [ ] Add custom-field sourcing/filtering sources after validating definition metadata and field links.
- [ ] Validate page-linked saved-search discovery and `N/search.load.promise` definition reads in an
  account, including restricted-role failures. Account-wide discovery/pagination is not implemented.
- [x] Saved-search discovery from supported definition links on the active page: explicit
  adapter action, bounded/deduplicated ID-only results, account/page/tab guards, append-only
  manual draft planning and discovery-only retry (ADR 0040). Fixture unit and light/dark
  browser coverage. No automatic definition read, pagination or account-wide discovery;
  live link shapes and restricted-role access remain unvalidated.
- [x] Where used input UX: Automation Map "Plan Where used" and per-card file shortcuts prefill
  `script:<fileId>` lines; bare `customsearch_*` accepted (ADR 0030). Prefill only; no read until
  scan. Fixture unit coverage; live link availability unvalidated.
- [x] Account script discovery: one-input "Scan all scripts" lists script-record files and an
  optional folder tree via read-only SuiteQL, resolves download links from File Cabinet pages
  (ADR 0031). Fixture unit and browser tests; sandbox probe of query columns and link shape only.
  Still open: live validation of modified-date/size skip (F-4.7), live NF-4.1/NF-4.2 measurements.
- [x] Discovery query cost: single-table script file IDs, batched `IN (…)` detail and folder
  reads, early stop at the file cap, metadata degraded to IDs when the `file` table is not
  readable, and an actionable timeout detail (ADR 0032). Fixes the `TIMEOUT` seen on the first
  live "Scan all scripts". Fixture unit coverage; live timing still unmeasured.
- [x] Classified read failures and a 7-day negative cache for permanent ones (ADR 0032
  addenda). Live cause of the 214 unchecked files identified: bundle-owned script sources
  answer HTTP 500. Fixture unit coverage. The observed 286-of-787 coverage preceded the bundle-filtering change
  below; it is historical diagnostic evidence, not current account coverage.
- [x] Bundle-owned files leave the plan: ancestor-chain resolution against the `SuiteBundles`
  root (verified `-16`, resolved by name), disclosed skip count, graceful fallback when the root
  is unreadable (ADR 0032 addendum 3). The 500-file cap now holds readable files only.

- [x] Three-source fixture acceptance: one explicit scan finds UE script, saved-search filter/formula
  and XML PDF references with source locations, validated transient file download links and the saved-search
  object link (ADR 0035). Unit and light/dark browser coverage includes cache restore and Refresh;
  download hashes never enter checkpoints/indexes. Live object/editor links remain unvalidated.

- [x] Explicit library filename exclusions for Scan all scripts: off-by-default switch, editable
  exact JS basenames, filtering before the plan cap, separate skipped-file names/IDs/count and
  coverage disclosure; no reads for excluded files. Unnamed and unlisted files stay included;
  manual plans bypass exclusions. View-local choices, unit and light/dark fixture coverage
  (ADR 0038). The new control still needs sandbox validation.
