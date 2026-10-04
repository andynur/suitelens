# Security, Privacy & Compliance

This document is mandatory. The extension runs inside an ERP that holds companies' financial data,
so trust is feature number one.

## 1. Threat model (summary)

| Threat | Example | Mitigation |
| --- | --- | --- |
| A malicious page calls the bridge | A script on the page sends a forged `postMessage` | Random per-tab nonce, origin check, operation allow-list |
| Data leaks to third parties | Query results sent to an analytics server | No analytics that send record data; telemetry is opt-in, anonymous, and never includes data |
| Arbitrary code execution | A "run snippet" feature gets abused | No free-form code execution in v0.x; later only through `chrome.userScripts` with explicit opt-in |
| Wrong environment | Writing to production while thinking it is sandbox | Environment Guard, read-only by default, confirmations that name the account |
| AI API key theft | Key stored in plain text | AES-GCM encryption with a passphrase, or session-only storage |
| Prompt injection via NetSuite data | Record text containing instructions for the AI | NetSuite data is treated as data; the AI has no write tools without confirmation |
| Supply chain | A malicious dependency | Lockfile, Dependabot, minimal dependencies, audit in CI |

## 2. Mandatory rules

1. No remote code; no `eval` / `new Function` in the extension.
2. `host_permissions` only for the NetSuite domains that are needed.
3. Never store NetSuite credentials in any form.
4. Data leaves the browser only when the user explicitly triggers an AI feature, after previewing what will be sent.
5. All write features (from the version that needs them) go through confirmation and are blocked on production by default.
6. Logs must never contain record values, query results or API keys.
7. HTML coming from NetSuite is never inserted into the DOM as HTML; always parse it and render it as text.

## 3. Privacy

- Public privacy policy from the first release.
- Minimum content: what data is accessed, where it is stored, when it leaves the browser, how to delete it.
- "Delete all data for this account" and "Delete all Loupe data" buttons in Settings.
- Be ready for GDPR/CCPA-style requests even though no personal data is collected by default.

## 4. Chrome Web Store compliance

- A written justification for every permission in the listing.
- Single-purpose statement: "Developer and admin productivity tools for NetSuite."
- Limited Use disclosure if any user data is processed.
- No obfuscated code; optional source maps; public repository.

## 5. Trademarks

- Display name: "Loupe for NetSuite". Technical slug: `netsuite-loupe`.
- Disclaimer in the README, store listing and About screen:
  "NetSuite is a trademark of Oracle Corporation. This project is not affiliated with Oracle."

## 6. Incident response

- Security reporting channel: `SECURITY.md` with a dedicated email address.
- Response target: 72 hours for critical reports.
- Ship the fix together with an honest changelog entry.
