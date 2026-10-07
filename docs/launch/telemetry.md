# Exactly what local feature counters collect

Collection defaults off. Enable **Settings → Local feature counters → Collect feature opens on
this device** to count explicit tab switches made through the tab bar.

The only allowed keys are `record`, `automation`, `console`, `inspector`, `restlets`, `impact`,
`logs`, `ai` and `settings`. Values are whole-number counters capped at 1,000,000. Counts have
no timestamp, session/account/record/user ID, URL, SQL, arguments, result values, source, errors
or provider/model name. Automatic feature reads and initial page opening do not create events.

The `telemetry:counts` Chrome local-storage entry contains these counters. **Copy counters**
produces JSON with `schemaVersion: 1` and `featureOpens`. Inspect it before voluntarily sharing
with maintainers. SuiteLens has no telemetry server, network request, background upload or tracking
identifier. This is a local usage aid, not a remote analytics pipeline.

Safe mode stops collection. **Delete counters**, turning collection off, or **Delete all SuiteLens
data** deletes the entry. Counters persist until deleted and are not keyed to NetSuite accounts.
The optional MCP activity log is separate and includes account/time metadata needed to review access;
see the privacy policy for its exact fields and retention.
