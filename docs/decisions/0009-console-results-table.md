# ADR 0009 — Virtualized console results table

## Status

Accepted

## Context

F-2.3 needs all returned columns, local sorting, column resizing and cell/row copying.
Rendering 50,000 rows as DOM nodes would overwhelm a narrow side panel. The usual panel
table pattern (three columns, percentage widths, only the tab body scrolling) cannot
represent arbitrary query results.

## Decision

Use a feature-local native table with a bounded 320px results viewport, horizontal
scrolling, sticky header, fixed 32px rows and five overscan rows on each side.
Render spacer rows for omitted results. Observe viewport height with ResizeObserver.
Expose total row count and absolute row indices to assistive technology. Long values
truncate with a title; the clipboard action retains the full value.

Keep every column encountered in returned rows. Sort a copy of the result array using
numeric/boolean comparisons and natural text ordering; ties keep query order, and
null/missing values stay last in both directions. Sort changes reset the viewport.

Resize columns with pointer capture or ArrowLeft/ArrowRight (16px), Home and End.
Widths are bounded to 96–640px. Copy cells as text (`null` for missing/null values),
and rows as JSON to preserve types and escape embedded tabs/newlines. Use the existing
clipboard helper for confirmation and failure feedback.

## Consequences

This is an explicit exception to DESIGN.md's ordinary panel table and scroll rules.
No new dependencies or NetSuite calls are needed. Values, sorting and widths stay in
panel memory and disappear when the result is replaced or the console is unmounted.
Unit tests exercise 50,000 local rows; execution remains capped at 5,000 until F-2.4.
Virtual rows outside the viewport are absent from browser find and the accessibility
tree. Users scroll the focusable results region to access other rows.
