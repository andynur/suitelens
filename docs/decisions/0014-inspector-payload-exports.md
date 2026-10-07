# ADR 0014 — Inspector payload exports and business-field masking

Status: accepted · Scope: PRD-03 F-3.3

## Context

Inspector search renders a filtered projection. Sharing requires a complete payload, with optional
business-data masking beyond the mandatory credential removal in ADR 0011.

## Decision

- Copy and download the complete loaded XML or normalized JSON in the selected format,
  independent of search and folding. Disable export while loading or after errors/context changes.
- Use browser clipboard and local Blob downloads without new permissions or permanent storage.
  Include account, type, record ID and masking status in sanitized download filenames.
- Keep screen-share and masking switches in component memory. Enabling screen-share mode enables
  masking; the user can explicitly disable it. Leaving screen-share mode does not reveal values.
- Clone the normalized tree and mask contact, address, tax, banking and personal fields by name,
  including named field wrappers, attributes and descendants. Display, search and exports consume
  the same masked tree. Unmasked XML uses the credential-stripped source; masked XML is serialized
  from the cloned tree with XML escaping. Switching masking off never restores credentials.
- Payload copy uses a generic success toast so record content does not linger in notifications.
  Reuse the existing local-download implementation through a shared helper.

## Consequences

Name matching is heuristic, not anonymization. The UI tells users to review before sharing and
notes that other values and related transactions may remain sensitive. These switches cover the
Inspector payload only; they do not mask other features or the underlying NetSuite page.
No new NetSuite APIs, bridge operations, account caches or persisted preferences are introduced.

Unit tests cover nested values/attributes, source immutability, escaping, complete exports during
search and masking opt-out. Fixture Chromium E2E covers keyboard enablement, clipboard writes and
actual local XML downloads in both themes. Real-account XML compatibility remains ADR 0011's VERIFY.
