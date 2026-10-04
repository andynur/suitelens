# Privacy Policy — Loupe for NetSuite

Last updated: October 4, 2026 · Applies to version 0.1

## What data Loupe accesses

When you open a NetSuite page (`https://<account>.app.netsuite.com`), Loupe reads, in your browser:

- the page URL (to find the account, environment, record type and record ID);
- the page's form labels (to show field IDs);
- the record's data, through the same record URL with `xml=T` and through NetSuite's own
  `N/currentRecord` module, using **your existing session and permissions**;
- script, deployment and workflow metadata, through SuiteQL queries run with your session.

Loupe never reads or stores your NetSuite password, session cookies or tokens.

## Where data is stored

- **Settings** (theme, feature toggles, colors, banner labels, Quick Go-to history) are stored in
  `chrome.storage.local` in your browser.
- **Cached metadata** (the Automation Map) is stored in your browser's IndexedDB, separated per
  NetSuite account ID, and expires after 24 hours.
- Record field values are shown on screen only and are not cached.

## When data leaves your browser

Never, in version 0.1. Loupe makes no network requests except same-origin requests to the
NetSuite page you have open. There is no analytics, telemetry, advertising or remote code.

Future versions may add optional AI features that send data only when you explicitly trigger
them with your own API key, after showing a preview of what will be sent. They will be opt-in
and described here before release.

## How to delete your data

- **Settings → Data → Clear cache for this account** removes cached metadata and Quick Go-to
  history for the current NetSuite account.
- **Settings → Data → Delete all Loupe data** removes every setting and all cached data.
- Uninstalling the extension removes all of its data from the browser.

## Contact

Questions or requests: open an issue in the project repository. Security issues: see
[SECURITY.md](SECURITY.md).

NetSuite is a trademark of Oracle Corporation. This project is not affiliated with Oracle.
