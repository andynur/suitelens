# PRD-04 — Sandbox source probe

Date: 2026-10-05 (Asia/Jakarta).
Environment: one authenticated sandbox session, Administrator role.
Scope: native NetSuite source surfaces; no record or template was saved.

## Observed script download

The Scripts list exposed a JavaScript file's File Cabinet record link at
`/app/common/media/mediaitem.nl?id=<fileId>`. That record displayed the file name,
JavaScript type, size and folder, and an actual HTTPS, same-origin source URL at
`/core/media/media.nl` with parameters `id`, `c`, `h` and `_xt`.
This is the URL shape accepted by the existing impact source validator.

Clicking the native Download button emitted a browser download event. Direct navigation
to the displayed source URL was blocked by the browser client; it is not evidence of
a NetSuite permission failure. No source file was opened from disk or added to the repository.
The event proves native download behavior, not a successful bounded read through
`NetSuiteAdapter`, source contents, scan results or HTTP status.

## Observed Advanced PDF editor

Customization → Forms → Advanced PDF/HTML Templates exposed an editor link at
`/app/common/custom/advancedprint/pdftemplate.nl`. A standard purchase template's
Customize link opened an unsaved custom-template editor. No Save action was taken.
The observed link includes template context such as `nl`, `tt`, `pt`, `source`,
`savedsearchid` and `rt`; its `id` is not established as a File Cabinet file ID.

Switching to Source Code exposed `textarea#source-template` with 8,387 characters
and a `<pdf>` element. The other template textareas contained visual-editor content
without that element. The page had no anchor to a `/core/media/` download URL.
Only aggregate DOM checks were recorded; template XML and download hashes are omitted.

The File Cabinet adapter request uses a `fileId` and reads observed media links.
It does not support this editor surface; a separate active-editor operation now exists
(ADR 0036), with fixture validation only. Supplying a template record
ID as `pdf-template:<fileId>` would target the wrong ID namespace. A future adapter
path needs explicit template identity/context, account/page ownership checks, bounded
XML reads, verified object links and no raw source persistence. This probe does not
establish a GET endpoint, saved custom-template behavior or access for other roles.

## Remaining validation

- End-to-end script acquisition and scanning through the installed SuiteLens adapter.
- Validate the implemented active Advanced PDF editor snapshot through the installed adapter.
- Validate saved custom templates, object identity/link round trips and restricted-role failures.
- Inventory skip, performance and throttling checks remain separate PRD tasks.

The browser policy blocked access to `chrome://extensions/`, so the installed extension
could not be inspected or reloaded in this probe. No alternative mechanism was used
to bypass that restriction. Fixture checks remain separate from these live observations.

## Follow-up editor identity probe

The same Administrator sandbox exposed standard Customize links in the visible template
list; no saved custom-template Edit link was observed. The standard editor's hidden
`input#pdftemplate-id` value was `-1`, despite a positive URL `id`. After selecting
Source Code, `input#pdftemplate-not-show-source` was `F`, and the single XML textarea
was `textarea#source-template[name="source-template"]`. Switching back to WYSIWYG
through the native mode-change warning changed the hidden source flag to `T` and restored
the visual-editor iframe; no template was saved. These signals inform ADR 0036;
they are not evidence of saved custom-template identity or an installed-adapter read.
No save action was taken. Only DOM shape, identity and aggregate source checks were
recorded; no template XML was added to the repository.
