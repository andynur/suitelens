import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { NativeRequestSchema, ToolInputs, MAX_FRAME_BYTES } from '../dist/protocol.js';
import { frameDecoder, encodeFrame } from '../dist/framing.js';
import { manifestDirectory } from '../dist/install.js';
const cli = resolve('dist/cli.js');

test('bounded native frames handle split/multiple messages and reject malformed payloads', () => {
  const values = [];
  const decode = frameDecoder((v) => values.push(v));
  const bytes = Buffer.concat([encodeFrame({ a: 1 }), encodeFrame({ b: 2 })]);
  for (const byte of bytes) decode(Buffer.from([byte]));
  assert.deepEqual(values, [{ a: 1 }, { b: 2 }]);
  const bad = Buffer.alloc(4);
  bad.writeUInt32LE(MAX_FRAME_BYTES + 1);
  assert.throws(() => frameDecoder(() => {})(bad));
  assert.throws(() => encodeFrame('x'.repeat(MAX_FRAME_BYTES)));
});
test('tools are strict, read-only and capped', () => {
  for (const sql of [
    'DELETE FROM x',
    'UPDATE x SET id=1',
    'SELECT 1; SELECT 2',
    'WITH x AS (DELETE FROM y) SELECT * FROM x',
  ])
    assert.equal(ToolInputs.run_suiteql.safeParse({ sql }).success, false);
  assert.equal(ToolInputs.run_suiteql.safeParse({ sql: 'SELECT 1', limit: 1001 }).success, false);
  assert.equal(
    ToolInputs.run_suiteql.safeParse({ sql: 'WITH x AS (SELECT 1) SELECT * FROM x' }).success,
    true,
  );
  assert.equal(ToolInputs.get_page_context.safeParse({ url: 'https://evil.test' }).success, false);
  assert.equal(NativeRequestSchema.safeParse({ tool: 'call_restlet' }).success, false);
  assert.match(manifestDirectory('darwin', '/user'), /NativeMessagingHosts$/);
  assert.match(manifestDirectory('linux', '/user'), /NativeMessagingHosts$/);
});
test('installer writes one exact extension origin and removes its own registration', async () => {
  if (process.platform === 'win32') return; // Requires Windows registry/ACL integration proof.
  const home = await mkdtemp(join(tmpdir(), 'suitelens-installer-'));
  const run = async (action) => {
    const child = spawn(process.execPath, [cli, action, 'a'.repeat(32)], {
      env: { ...process.env, HOME: home },
      stdio: 'ignore',
    });
    const [code] = await once(child, 'exit');
    assert.equal(code, 0);
  };
  try {
    await run('install');
    const path = join(manifestDirectory(process.platform, home), 'com.suitelens.bridge.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${'a'.repeat(32)}/`]);
    assert.equal(manifest.type, 'stdio');
    assert.match(await readFile(manifest.path, 'utf8'), /^#!\/bin\/sh/);
    await run('uninstall');
    await assert.rejects(readFile(path));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
test(
  'real MCP stdio + native process + local IPC transports carry authorization errors and results',
  { timeout: 20_000 },
  async () => {
    const home = await mkdtemp(join(tmpdir(), 'suitelens-transport-'));
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [cli, 'serve'],
      env,
      stderr: 'pipe',
    });
    const client = new Client({ name: 'transport-test', version: '1' });
    let native;
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      assert.equal(tools.tools.length, 6);
      assert.equal(
        tools.tools.some((t) => t.name === 'call_restlet'),
        false,
      );
      native = spawn(process.execPath, [cli, 'native'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
      let approved = false;
      const decode = frameDecoder((raw) => {
        const request = NativeRequestSchema.parse(raw);
        assert.equal(request.agent, 'transport-test');
        native.stdin.write(
          encodeFrame(
            approved
              ? {
                  type: 'response',
                  id: request.id,
                  ok: true,
                  data:
                    request.tool === 'read_context'
                      ? '# sandbox schema'
                      : { fields: [{ id: 'memo' }] },
                }
              : { type: 'response', id: request.id, ok: false, error: 'NOT_AUTHORIZED' },
          ),
        );
      });
      native.stdout.on('data', decode);
      // The native host reads the rendezvous and connects asynchronously. Poll an inert tool.
      let denied;
      for (let n = 0; n < 30; n++) {
        denied = await client.callTool({ name: 'get_page_context', arguments: {} });
        if (JSON.stringify(denied).includes('NOT_AUTHORIZED')) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.equal(denied.isError, true);
      assert.match(JSON.stringify(denied), /NOT_AUTHORIZED/);
      const invalid = await client.callTool({
        name: 'run_suiteql',
        arguments: { sql: 'DELETE FROM transaction' },
      });
      assert.equal(invalid.isError, true);
      for (let n = 0; n < 4; n++) {
        const oversized = await client.callTool({
          name: 'run_suiteql',
          arguments: {
            sql: 'SELECT ?',
            params: Array.from({ length: 100 }, () => 'x'.repeat(10_000)),
          },
        });
        assert.equal(oversized.isError, true);
      }
      const afterOversized = await client.callTool({ name: 'get_page_context', arguments: {} });
      assert.match(JSON.stringify(afterOversized), /NOT_AUTHORIZED/);
      approved = true;
      const result = await client.callTool({
        name: 'get_record_schema',
        arguments: { recordType: 'salesorder' },
      });
      assert.equal(result.isError, undefined);
      assert.match(JSON.stringify(result), /memo/);
      const resource = await client.readResource({ uri: 'netsuite-context://record/salesorder' });
      assert.match(JSON.stringify(resource), /sandbox schema/);
    } finally {
      native?.stdin.end();
      native?.kill();
      await client.close();
      await transport.close();
      await rm(home, { recursive: true, force: true });
    }
  },
);

test(
  'native reconnect drops a late browser reply from the previous client',
  { timeout: 10_000, skip: process.platform === 'win32' },
  async () => {
    const { createServer } = await import('node:net');
    const { randomUUID } = await import('node:crypto');
    const { mkdir, writeFile } = await import('node:fs/promises');
    const home = await mkdtemp(join(tmpdir(), 'sl-reconnect-'));
    const directory = join(home, '.suitelens-mcp');
    await mkdir(directory, { mode: 0o700 });
    const endpoint = join(directory, 'bridge.sock');
    const server = createServer();
    server.listen(endpoint);
    await once(server, 'listening');
    await writeFile(
      join(directory, 'endpoint.json'),
      JSON.stringify({ endpoint, pid: process.pid }),
      { mode: 0o600 },
    );
    const native = spawn(process.execPath, [cli, 'native'], {
      env: { ...process.env, HOME: home },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const browserRequests = [];
    native.stdout.on(
      'data',
      frameDecoder((v) => browserRequests.push(v)),
    );
    let peer;
    try {
      [peer] = await once(server, 'connection');
      const oldId = randomUUID();
      const newId = randomUUID();
      const makeRequest = (id) => ({
        type: 'request',
        id,
        sessionId: randomUUID(),
        agent: 'local test',
        tool: 'get_page_context',
        input: {},
      });
      peer.write(encodeFrame(makeRequest(oldId)));
      for (let n = 0; !browserRequests.length && n < 40; n++)
        await new Promise((r) => setTimeout(r, 10));
      assert.equal(browserRequests[0].id, oldId);
      const reconnected = once(server, 'connection');
      peer.destroy();
      [peer] = await reconnected;
      const replies = [];
      peer.on(
        'data',
        frameDecoder((v) => replies.push(v)),
      );
      peer.write(encodeFrame(makeRequest(newId)));
      for (let n = 0; browserRequests.length < 2 && n < 40; n++)
        await new Promise((r) => setTimeout(r, 10));
      assert.equal(browserRequests[1].id, newId);
      native.stdin.write(
        encodeFrame({ type: 'response', id: oldId, ok: true, data: 'PREVIOUS-CLIENT-DATA' }),
      );
      native.stdin.write(
        encodeFrame({ type: 'response', id: newId, ok: false, error: 'NOT_AUTHORIZED' }),
      );
      for (let n = 0; !replies.length && n < 40; n++) await new Promise((r) => setTimeout(r, 10));
      assert.deepEqual(replies, [
        { type: 'response', id: newId, ok: false, error: 'NOT_AUTHORIZED' },
      ]);
    } finally {
      peer?.destroy();
      native.stdin.end();
      native.kill();
      server.close();
      await rm(home, { recursive: true, force: true });
    }
  },
);
