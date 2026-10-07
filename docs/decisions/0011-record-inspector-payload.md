# ADR 0011 — Active-record XML and JSON Inspector

Status: accepted · Scope: PRD-03 F-3.1

## Context

Field Explorer intentionally truncates field values and keeps only sublist metadata. Record
Inspector needs the saved server payload, full values and sublist lines. Record XML may also
contain session tokens and must never be inserted into the DOM as HTML.

## Decision

- Add `NetSuiteAdapter.getRecordXml(ref, accountId)` and a Zod-validated content operation.
  The content script uses the existing same-origin `xml=T` GET; no MAIN-world operation is
  added. Validate the active account, record and URL before and after the asynchronous fetch.
  LiveAdapter additionally rechecks the target tab. FixtureAdapter requires an exact fixture.
- Remove credential-like elements, named fields and attributes using the existing sensitive
  field matcher before XML crosses the content boundary. Remove comments and processing
  instructions. Reject DTD/entity declarations, malformed XML, non-record responses and
  mismatched record attributes when present. Bound payloads to 5 Mi characters, 20,000 node
  visits and depth 40; excessive data gets a friendly error rather than silent truncation.
- Preserve the remaining XML root and normalize JSON as `{ name, attributes, content }`.
  `content` is an ordered array of text and child nodes. Repeated fields, sublist lines,
  attributes, empty elements and uncoerced full text values survive; formatting indentation
  between child elements is excluded from JSON. XML serialization may normalize formatting.
- Render both representations as React text in keyboard-accessible native disclosure trees.
  Collapsed branches do not mount descendants. Search retains matching branches and their
  ancestor paths, expanding matches automatically. JSON search shows a filtered projection,
  not an exportable complete JSON document. Payload export belongs to F-3.3.
- Add a separately configurable Inspector tab. Payloads live only in component memory and
  are released when leaving the tab; account/page changes invalidate pending loads. Refresh
  explicitly reads again. Wrapping tabs support narrow panels while keeping navigation outside the scrolling body.

## Consequences and validation

The Inspector describes the saved server record even on an edit page; it does not include
unsaved form values. This is stated in the UI. Credential removal is mandatory, while optional
masking of business fields remains F-3.3. No payloads enter IndexedDB or extension storage.

Parser tests cover all three record fixtures, long/repeated/mixed text, credential removal,
identity checks and limits. Adapter/content tests cover scoped messaging and navigation races.
Fixture Chromium E2E covers XML/JSON, search, pointer/keyboard folding and refresh in both themes,
feature toggles and the LiveAdapter transport against intercepted fixture XML. Real-account
`xml=T` shape and permissions remain VERIFY; automated tests never contact a real account.
