# Frequently asked questions

## Is this an Oracle product?

No. NetSuite is a trademark of Oracle Corporation. This project is not affiliated with Oracle.

## Does it need an Administrator role?

No. Reads use your existing browser role and may return partial metadata or a friendly error when
columns/permissions differ. Consult the account's Records Catalog rather than escalating roles blindly.

## Does it write records?

Core exploration is read-only. The RESTlet tester can send an explicit write only after a named
confirmation; production writes require a separate per-account setting. The MCP bridge exposes no
write tools. AI-generated SQL is a draft, not an automatically executed query.

## Is client data sent to maintainers?

No automatic upload exists. Local feature counters collect only tab counts if enabled. AI calls
send your confirmed preview to your chosen provider. Approved local MCP clients receive results
and can forward them under their own policies. Review the privacy policy before using either.

## Why are some fields or files missing?

Fields describe the matching open record; catalogs and role visibility are partial. File Cabinet
reads use supported observed links. Bundle-owned or inaccessible files remain not checked. Where
used reports possible text references, not a full dependency graph or runtime coverage.

## How do I recover from a broken tab?

Use Retry or Open Settings in its error boundary. Enable Safe mode to disable every feature while
keeping your stored toggles. Reload the extension and refresh the NetSuite tab after updating.

## How do I report a bug?

Use the repository bug template with reproduction steps and redacted error codes. Never attach
client data, query rows, source or API keys. Report vulnerabilities privately using Security Advisories.
