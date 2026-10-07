# 0003 — Extension permissions

- Status: Accepted
- Date: 2026-10-04

## Decision

| Permission | Justification (also used for the Chrome Web Store listing) |
| --- | --- |
| `sidePanel` | The workbench UI is a Chrome side panel. |
| `storage` | Settings, per-account preferences, Quick Go-to history; `storage.session` for the pending view requested by a keyboard command. |
| `scripting` | Injects the content script into NetSuite tabs opened before the extension was installed or updated, so the user does not have to reload them. |
| `activeTab` | Lets the toolbar button and keyboard commands act on the current tab. |
| host `https://*.app.netsuite.com/*` | Read the NetSuite page (URL, form labels, record XML) and run the bridge. No other hosts; never `<all_urls>`. |
| optional hosts of the AI provider catalog (`https://api.anthropic.com/*`, `https://api.openai.com/*`, `https://generativelanguage.googleapis.com/*`, `https://api.groq.com/*`, `https://api.deepseek.com/*`, `https://dashscope-intl.aliyuncs.com/*`, `https://api.moonshot.ai/*`, `https://api.z.ai/*`, `https://api.minimax.io/*`, `https://openrouter.ai/*`) | AI Assist (PRD-05, ADR 0041, ADR 0043). Only the chosen provider's origin is requested, at runtime, when the user saves that provider's key; never at install. Used only by the background worker for AI calls the user triggered after a preview. |

Not requested: `tabs` (tab URLs are available for NetSuite hosts through the host permission),
`cookies`, `webRequest`, `clipboardWrite` (the side panel copies on a user gesture).

`web_accessible_resources` exposes only `bridge.js`, and only to NetSuite pages, because the
content script injects it as a `<script src>` into the MAIN world (see ADR 0004).

The extension-pages CSP is `script-src 'self'; object-src 'self'; base-uri 'none';
frame-ancestors 'none'`.

## Consequences

`scripting` and `activeTab` do not trigger install-time warnings. The host permission shows
"Read and change your data on *.app.netsuite.com", which matches the product's purpose.
