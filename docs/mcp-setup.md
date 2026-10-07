# Local MCP setup

SuiteLens for NetSuite exposes six read-only tools and record-context resources to a coding agent
on the same computer. It uses stdio, Chrome Native Messaging and local-domain IPC (Unix socket on
macOS/Linux, a named pipe on Windows). It opens no TCP/HTTP listening ports and stores no NetSuite
credentials. The agent uses your browser session and role; this does not grant additional NetSuite
permissions.

**Data disclosure:** approved agents receive query rows and script source as well as metadata.
The agent may send these to its own model provider. SuiteLens's AI preview does not control that
agent. Approve only a client you started and trust. Agent names are self-reported.

## Install

Requirements: Node.js 22.22 or later, Google Chrome, and SuiteLens installed in Chrome.
The npm package is prepared in this repository; do not assume it is published until the release
checklist records its npm URL and successful fresh installation.

After npm publication, one command installs the package and registers the native host:

```sh
npm install --global netsuite-suitelens-mcp && netsuite-suitelens-mcp install <extension-id>
```

Find the 32-letter extension ID in `chrome://extensions`. The installer registers exactly that
extension origin, never a wildcard. For an unpacked build, IDs can change when its path changes;
repeat installation with the new ID. The registration points at your installed Node executable
and package; keep both installed and repeat registration after moving either.

Before publication, from a source checkout:

```sh
pnpm install
pnpm build:mcp
node packages/mcp-bridge/dist/cli.js install <extension-id>
```

Configure your MCP client to start `netsuite-suitelens-mcp serve`. For a source checkout, use
`node` as the command and the **absolute** path to `packages/mcp-bridge/dist/cli.js` followed by
`serve` as arguments. Never point an agent at a fixture build when expecting account data.

## Claude Code

Register the stdio server:

```sh
claude mcp add --transport stdio suitelens -- netsuite-suitelens-mcp serve
```

Source checkout:

```sh
claude mcp add --transport stdio suitelens -- node /absolute/path/suitelens/packages/mcp-bridge/dist/cli.js serve
```

Start Claude Code, then connect and approve in SuiteLens as described below. Ask it to call
`get_record_schema` with `recordType: "salesorder"` while a sandbox sales order is open.

## Claude Desktop

Add an entry to your Claude Desktop MCP configuration, then restart the client:

```json
{
  "mcpServers": {
    "suitelens": {
      "command": "netsuite-suitelens-mcp",
      "args": ["serve"]
    }
  }
}
```

If the desktop app cannot find global npm binaries, use absolute paths for Node and the built CLI.

## Cline

In Cline's MCP Servers configuration, add the same `mcpServers.suitelens` stdio entry above.
Keep tool approval prompts enabled. A client-side approval is separate from SuiteLens's account
approval; both are required where the client uses its own prompts.

## Connect and approve

1. Open a NetSuite record in a sandbox. In SuiteLens Settings, enable **Local MCP bridge**.
2. Click **Connect this tab** and grant Chrome's optional Native Messaging permission.
3. Run a read-only tool in the client. Its first request returns `NOT_AUTHORIZED`; it creates an
   approval request in SuiteLens Settings, without reading account data.
4. Review the self-reported agent name, account ID, environment and disclosure. Click **Allow for
   1 hour**, then retry the client tool. Each new MCP process has a new session and needs approval.
5. Use **Deny / Revoke** or **Disconnect and revoke access** to stop access. Disabling the feature,
   Safe mode, navigation of the connected tab, browser exit and worker restart revoke access.

Production is denied by default. The separate **Allow local MCP access for this production
account** preference is required before approval; it does not enable writes. Unknown environments
are always denied. Cosmetic environment overrides never bypass this check. The pinned tab and
account are checked before and after every adapter read, and again before returning results.
A dispatched NetSuite read may finish after cancellation, but its result is discarded.

## Tools and limits

| Tool | Inputs | Coverage |
| --- | --- | --- |
| `get_page_context` | none | Allow-listed context fields; no raw page URL |
| `get_record_schema` | `recordType` | Metadata only from the open matching record; no values |
| `get_automations` | `recordType` | Role-visible script/workflow metadata with limitations |
| `run_suiteql` | `sql`, optional `params`, `limit` | One SELECT/WITH; default 100 rows, maximum 1,000 |
| `where_used` | `id` | Up to 20 discovered script files; possible text references, never account-wide proof |
| `get_script_source` | script internal ID or `customscript_` ID | Resolves script record to file ID; observed File Cabinet link only, no guessed URL |

`netsuite-context://record/salesorder` is a Markdown resource generated on demand by the existing
metadata-only AI Context exporter. Other record-type IDs use the same URI template. Resources need
the same session approval and rate limit; they are not a route around tool authorization.

Only one read runs at a time; each approved session can run 20 requests per minute. A request has
a 55-second browser deadline and a 60-second host deadline. Native frames are capped at 900,000
UTF-8 bytes, below Chrome's host-to-browser message limit. Large source/results return `TOO_LARGE`.
No raw SQL, parameters, rows, source, errors or URLs are stored in the MCP activity log. Its last
200 entries contain only tool, time, account, row/reference count and outcome. Delete it in Settings;
it is session storage, reset on a new connection/worker restart and cleared by browser exit or **Delete all SuiteLens data**.

## Troubleshooting and uninstall

- `DISCONNECTED`: start the client, check the native host registration, then connect in Settings.
- `NOT_AUTHORIZED`: approve the pending session and retry. If approval fails, check the pinned
  page and production preference. Reconnect after navigating or after the one-hour grant expires.
- `READ_FAILED`: the role, catalog columns or File Cabinet source link may be unavailable. Use
  the equivalent SuiteLens view to inspect coverage; never increase role permissions blindly.
- One MCP server is supported per OS user/browser profile. Close it before starting another client.
- After a crash, a stale socket or `~/.suitelens-mcp/endpoint.json` may remain. Check the recorded
  PID and stop/confirm the old process has exited before deleting the endpoint file and socket.
  Do not remove the rendezvous while a client is running.
- Default Chrome Native Messaging locations are supported. Chromium, alternate browser channels,
  custom Linux config directories and multiple profiles need manual registration review.
- macOS transport and installer tests use temporary homes. Windows registry/ACL/launcher behavior
  and Linux Chrome integration require live verification before claiming those platforms supported
  in a public store listing.

Disconnect in SuiteLens, then run:

```sh
netsuite-suitelens-mcp uninstall <extension-id>
npm uninstall --global netsuite-suitelens-mcp
```

The uninstall command removes the manifest and host launcher (and Windows registry key). It does
not delete other packages, browser data or an active MCP process.

## Local bridge or Oracle AI Connector Service?

Use this local bridge for deliberate developer exploration in a sandbox, using a visible browser
record and the user's existing role. It is read-only and requires the local extension and host.
For managed organizational integrations, evaluate Oracle's official AI Connector Service, its
OAuth 2.0 authentication, roles, permissions and official tools. SuiteLens does not implement or
replace that service, and does not imply Oracle approval. Check your organization's policies and
the AI client's data handling before choosing either route.

Sources: [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging),
[MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server),
[Oracle AI Connector FAQ](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_4160616848.html),
[Claude Code MCP](https://code.claude.com/docs/en/mcp),
[Cline MCP](https://docs.cline.bot/mcp/mcp-overview),
[Claude Desktop local setup](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers).
