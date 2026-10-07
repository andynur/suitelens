# ADR 0025 — Impact identifier shortcuts

Status: Accepted

## Context

The explicit linked-file workbench supplies a free-input entry point. F-4.1 also calls for
shortcuts from Field Explorer and Automation Map. Account discovery and verified risk metadata
remain outstanding.

## Decision

Pass an optional Where used callback from the panel to Field Explorer and Automation Map when
Impact Analysis is enabled. Body, off-form and sublist field actions pass the field ID; expanded
automation cards pass their available script/workflow identifier. File Cabinet IDs and deployment
IDs are not substituted for object identifiers. Missing identifiers have no shortcut.

The panel switches tabs and supplies an ephemeral initial identifier scoped to the originating
adapter, account and page URL. Leaving the tab, disabling the feature or changing context clears
the handoff. The workbench keeps its identifier editable and requires an explicit file plan and
scan action. Opening a shortcut neither reads source content nor starts discovery or scanning.

## Consequences

This completes the entry-point slice of F-4.1. References to workflow identifiers can be sought
in supplied script/template text; workflow definitions themselves are still not scanned. Existing
coverage and unknown-risk notices continue to apply. Tests use fake sources only.
