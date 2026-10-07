# ADR 0027 — Static script dependency lists

Status: Accepted

## Context

PRD-04 F-4.6 asks for a nested script → imported-library list. Regex matching can mistake
comments or strings for AMD declarations. Loading a module to discover its dependencies would
execute account code and violate the read-only analysis boundary.

## Decision

Bundle Acorn locally as a production dependency and parse bounded script text without execution.
Inspect only direct top-level `define` calls, including named declarations. List string-literal
array elements with one-based locations, preserving declaration order and duplicate imports.
Comments, strings, regexes, member calls and nested calls do not become declarations. Dynamic
elements, malformed syntax, unsupported signatures and missing declarations have explicit
not-checked reasons; partial literal lists never imply complete coverage.

Cap a file at 20 declarations, 200 module literals per declaration, and 512 characters per
module name. Display the nested list under each linked script regardless of reference count.
Keep lists in detached run-local snapshots, like excerpts. Checkpoints remain positions/status
only; restoring/resuming completed files explains that Refresh is needed to read dependencies.

## Consequences

This is a static declaration list, not module resolution, execution proof, account discovery or
a transitive dependency graph. Even a top-level identifier can be rebound by account code;
the UI states the syntactic scope. No library links are manufactured, no new network operation
is introduced, and no source text is persisted. Acorn adds a bundled parser to the side panel.

## References

- [Oracle define signature](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4600491925.html)
- [Acorn parser documentation](https://github.com/acornjs/acorn/blob/master/acorn/README.md)
