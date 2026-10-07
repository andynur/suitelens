# ADR 0013 — Related transaction tree

Status: accepted · Scope: PRD-03 F-3.2

## Context

The Inspector needs a view of transactions linked to the active saved transaction. Links form
an account-scoped graph: multiple line items can repeat the same document link, an invoice
can link directly to its sales order, and shared records or cycles cannot be treated as a
single chronological chain. Available relationship tables and permissions remain account dependent.

## Decision

- Load explicitly from the Inspector, only for saved transaction types in the existing URL map.
  Keep XML/JSON inspection independent so a missing relationship table does not hide the payload.
  The Inspector feature toggle also disables this view.
- Put the SQL, Zod row schema and mapper in `src/netsuite/queries/transactions.ts`. Read adjacent
  document links in either direction from `NextTransactionLineLink`, joining `transaction`
  twice for IDs, document numbers and raw types. Bind every ID; SELECT DISTINCT and the mapper
  deduplicate line links. Reject unexpected columns/IDs or unrelated rows rather than showing
  a misleading empty graph. Do not silently replace a failed table read with invented links.
- Reuse `NetSuiteAdapter.runSuiteQL` and its existing schema-validated read-only transport,
  account checks and paging. No new bridge capability, permissions or storage are needed.
  Check the active account, record and URL before and after every query; Inspector remounts
  the tree on navigation/account/adapter-mode changes. Abort the local walk on unmount/rerun.
- Walk breadth first, with at most 25 IDs per batch (50 bound parameters), 100 nodes, 500
  document links, and four link hops. Apply a 30-second deadline to the entire walk. Mark row,
  edge, node or depth limits as a partial tree. Cancellation releases the local wait and prevents
  further queries; an already dispatched NetSuite query may still complete.
- Render a native disclosure tree rooted at the active record, using actual edge directions
  and raw link types. Shared or cyclic nodes become reference leaves. Generic transaction
  links stay on the source account origin. Do not infer fulfillment → invoice chronology
  when the data actually has sales-order → fulfillment and sales-order → invoice branches.
- Store results only in component memory. Fixture mode recognizes the exact generated query
  with bound IDs and returns only adjacent fake links; it is not a general SQL engine.

## Consequences and verification

Unit tests cover the query guard/parameters, row mapping, duplicate links, traversal from both
ends, cycles/shared nodes, limits, cancellation, wrong accounts, malformed responses, permissions,
UI retry/empty states and navigation races. Fixture Chromium E2E exercises the sales order,
fulfillment, invoice and payment graph, same-account links, keyboard folding and refresh in both
light and dark themes.

VERIFY on a real sandbox: `NextTransactionLineLink.previousdoc`, `nextdoc`, `linktype`,
`transaction.id`, `tranid`, `type`, relationship directions (especially payment applications),
role visibility, client `N/query` availability and generic `transaction.nl?id=` redirects.
These table/column assumptions are not presented as live-account verified. Oracle directs
users to the account's Records Catalog for available fields and joins:
<https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_157909186990.html>.
The combined fixture-and-real-account PRD acceptance criterion stays unchecked until manual
verification is recorded.
