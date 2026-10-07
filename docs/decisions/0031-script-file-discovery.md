# ADR 0031 — Script file discovery and File Cabinet link resolution

Status: Accepted

## Context

ADR 0021 reads a file only through a `media.nl` link present in the active page, so a
file list had to be typed by hand. In one sandbox account we observed: `file`,
`script.scriptfile` and `mediaitemfolder` are queryable; `media.nl?id=` without the per-file
hash redirects to a not-found page; the File Cabinet file page and folder listing page
contain valid `media.nl?id,c,h,_xt` links and those links download script text.

## Decision

- "Scan all scripts" lists files with read-only SELECTs through `NetSuiteAdapter.runSuiteQL`
  (statements in `queries/impactFiles.ts`): files of all script records, plus optional `.js`
  files in one folder tree (depth-limited by 200 folders). Plans keep the 500-file cap and
  disclose truncation. Discovery reads no content.
- When the active page has no link for a file, the content script fetches fixed same-origin
  File Cabinet pages (`mediaitemfolders.nl?folder=<id>` when a folder ID is known, else
  `mediaitem.nl?id=<id>`), scans the HTML as text only (never into the DOM) and accepts a link
  only if it passes the unchanged ADR 0021 validation. Links are never constructed.
- The hash-bearing link and fetched pages live in content-script memory only (2 minutes, 10
  folder pages); nothing is persisted or logged. The optional folder ID is stored in plan
  checkpoints like the file ID.

## Consequences

One input scans an account's script files. Folder pages that are not fully listed or roles
without File Cabinet access fall back to a per-file page or report the file as not checked.
Library files outside script records and folders are not discovered. The live column
names are confirmed in one account only (VERIFY). Skipping unchanged files by size/modified
date (F-4.7) and NF-4.1/4.2 timing remain open.
