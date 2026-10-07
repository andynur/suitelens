# ADR 0036 — Active Advanced PDF editor source snapshot

Status: Accepted

## Context

Advanced PDF/HTML source resides in an editor textarea, without a File Cabinet download
link. In a sandbox standard Customize editor, the URL ID refers to the base template,
while hidden `pdftemplate-id` is `-1`. Treating that URL ID as a saved template or a
File Cabinet ID would misidentify the source.

## Decision

Add `NetSuiteAdapter.readImpactPdfEditor` and Zod-validated content messaging. Read only
the active, recognized HTTPS NetSuite editor page, with a bounded numeric `editorId`.
No URL is supplied by the caller, endpoint constructed, network request issued, native
editor control clicked or template saved. The content service requires exactly one
source textarea, hidden identity and source-mode flag. Missing or ambiguous signals
fail closed with instructions to select Source Code.

Hidden identity `-1` means unsaved customization. Positive identity is accepted only
when it matches the editor URL ID and the URL is not a standard/new customization.
That branch has fixture evidence only; it remains VERIFY until a saved custom template
is checked in an account. Editor IDs, template IDs and File Cabinet file IDs remain
separate namespaces. XML is handled only as bounded text; it is never parsed, executed
or rendered as HTML.

Where used exposes an explicit **Scan open PDF editor** action on supported editor
pages. It uses the existing candidate scanner and shows locations without XML excerpts.
Raw source, candidate results and editor links are memory-only, outside file plans,
checkpoints, negative caches, indexes and the file-plan summary. Identifier, account,
page or adapter changes clear results and discard late replies. Response validation
rechecks the exact page URL and account; a local timeout bounds the wait.

The link reopens the observed editor context; it does not reproduce unsaved changes.
The UI labels results as current editor snapshots that may include unsaved edits and
asks users to scan again after editing. Text matches do not establish runtime usage,
saved-template state or account coverage.

## Consequences

One open editor can be checked without conflating it with exported XML files. The native
sandbox probe confirms the unsaved identity and source-mode signals, and fixture tests
cover the content service, adapters, failures, stale responses and both UI themes.
Installed-extension acquisition, saved custom templates, embedded editors and restricted
roles still require live validation. Unsupported URL parameters or DOM variants return
an actionable error rather than guessing an endpoint or identity.
