# SuiteQL console notes

- Only one SELECT or WITH … SELECT is accepted. A conservative lexical guard rejects writes,
  multiple statements and incomplete literals/comments; this is not a full SQL parser.
- `?` accepts text, finite number or boolean through N/query bound parameters. Use true/false
  for booleans. Quotes and comments do not consume parameter slots. Named snippet variables map
  to positional placeholders; no string substitution is performed.
- Single-call SuiteQL has a 5,000-row ceiling. The console wraps reads in nested ROWNUM queries
  with 1,000 rows per page. Use a unique ORDER BY. Queries without stable ordering or accounts
  changing during a run can return inconsistent pages. A reserved paging alias is rejected.
- The default fetched-row cap is 50,000; the session control accepts 1–100,000. At the cap, the
  console warns that more rows may exist, including when an exact full page ends at the cap.
- Cancel stops local waiting and further page requests. Already dispatched NetSuite work cannot
  be terminated. Each page has a 30-second timeout. Errors retain NetSuite's message and hints.
- Metadata indexing is partial and role-dependent. Sources and result mappers are in
  `src/netsuite/queries/metadata.ts`; VERIFY each account's metadata columns in Records Catalog.
  Indexing pauses between requests and stops on error, navigation away or account change.
- To extend a partial index, import a JSON array such as:

  ```json
  [
    { "name": "transaction", "columns": ["id", "tranid"], "source": "imported" }
  ]
  ```

  Only identifiers are retained. Obtain those identifiers from the account's Records Catalog;
  sample record values and credentials must not be included.
- Snippet JSON uses `{ "version": 1, "snippets": [...] }`. Export/import includes description,
  tags and named variable defaults. Files are limited to 2 MB and 200 snippets per account.
- CSV is BOM-prefixed UTF-8 and protects formula-like strings. Unit tests verify encoding and
  escaping; actual Excel/Google Sheets import needs manual verification.
- Raw-SQL paged API column-name limitation:
  <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_0429112941.html>.
  Parameter support and single-call limit:
  <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0429104416.html>.
  Records Catalog:
  <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_160276344912.html>.
