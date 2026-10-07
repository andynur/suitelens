# ADR 0044 — Explicit local MCP session access

Status: accepted, October 6, 2026. Scope: PRD-06. The user explicitly authorized an exception to
the browser-only data rule for this local, approved, read-only MCP bridge.

## Decision

The Node MCP SDK server uses stdio with the coding agent. Chrome launches a separate native-host
process from `connectNative`; Chrome cannot be assumed to attach to the agent's existing process.
The two local processes exchange bounded Native Messaging frames over a user-private Unix socket
(or Windows named pipe). No network port, HTTP endpoint or credential is introduced.

Native Messaging is an optional permission requested by a Connect button, and the feature is off
by default. A shared Zod protocol lives in the separately packaged bridge and is re-exported by
the extension protocol. All six tools and Context resources use one authorization engine and the
existing NetSuiteAdapter. SELECT/WITH validation is shared with the SuiteQL console.

Grants last one hour, exist only in worker memory, and bind a native connection, client session,
account, detected environment and exact page URL. Navigation, disconnect, restart or revocation
invalidates them; reads are guarded before and after every adapter call. Production requires a
separate per-account preference, with unknown environments denied. Display overrides cannot grant
production access. Only one read is active, with 20 requests/minute/session and bounded output.

The UI explicitly warns that the local agent can forward data to its model provider. The agent
name is self-reported, not authenticated identity. Local processes running as the same OS user
are inside the trust boundary. No data is written to the IPC rendezvous or native logs.

Activity is a bounded session-only metadata log with deletion. Worker restart revokes grants and
clears stale state. Source reads preserve observed-link File Cabinet limitations; text matches
remain possible, not runtime/account-wide proof. Tests do not prove a real NetSuite schema or
File Cabinet response; live sandbox/Claude Code validation remains a release gate.
