# ADR 0017 — RESTlet session requests and local collections

Status: accepted

RESTlet execution uses an allow-listed, Zod-validated `callRestlet` content operation through
NetSuiteAdapter. The content service builds `/app/site/hosting/restlet.nl` on the current page
origin; callers cannot choose a URL. Session credentials are same-origin, redirects are rejected,
and calls time out after 30 seconds with a 2 MB streamed response cap. Authentication errors and
HTML login pages explain that an external authenticated client may be required. The app-domain
endpoint and browser-session compatibility remain VERIFY; no cross-domain fallback is attempted.

GET cannot contain a body. POST, PUT and DELETE require a confirmation naming the deployment,
account and detected environment. Production and release preview require an explicit per-account
allowProductionWrites preference; unknown environments are blocked. The content service checks
this independently of the panel. Display environment overrides cannot weaken this policy. A
confirmed request is an immutable snapshot; target changes invalidate the response, with a warning
that an already dispatched write may have completed. Arbitrary RESTlets can have side effects even
on GET; only use deployments whose behavior the user understands.

Collections and sandbox/production variable presets are schema-validated under
`acct:<accountId>:restlets` in local extension storage. Saving is explicit; responses stay in
component memory. Confirmation is never persisted. Presets substitute values and never change the
target account or origin. Credential-named fields, authentication header values and browser-controlled
headers are rejected before execution or persistence. Users remain responsible for omitting secrets
embedded in arbitrary business text. Delete individual requests or use Settings Delete all data.

Reference: [Oracle RESTlet authentication](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N2971402.html)
documents session-cookie reuse for clients hosted by the same account. This supports the approach;
actual content-script and account-domain compatibility still requires sandbox verification.
