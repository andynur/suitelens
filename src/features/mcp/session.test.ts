import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createMcpSession, APPROVAL_MS } from './session';
import { fixtureAdapter } from '../../test/adapters';
import { detectFromUrl } from '../../netsuite/context/detect';
import {
  ToolInputs,
  type NativeRequest,
  type ToolName,
} from '../../../packages/mcp-bridge/src/protocol';
const url = 'https://1234567-sb1.app.netsuite.com/app/accounting/transactions/salesord.nl?id=1001';
function setup(environment = 'sandbox') {
  const context = detectFromUrl(environment === 'sandbox' ? url : url.replace('-sb1', ''))!;
  const adapter = fixtureAdapter();
  vi.spyOn(adapter, 'getPageContext').mockResolvedValue(context);
  const enabled = vi.fn().mockResolvedValue(true);
  const allowProduction = vi.fn().mockResolvedValue(false);
  let time = 1_000_000;
  const publish = vi.fn().mockResolvedValue(undefined);
  const bridge = createMcpSession({
    adapter,
    context,
    enabled,
    allowProduction,
    publish,
    now: () => time,
  });
  const sessionId = randomUUID();
  const request = (tool: ToolName, input: unknown = {}): NativeRequest => ({
    type: 'request',
    id: randomUUID(),
    sessionId,
    agent: 'Test agent',
    tool,
    input,
  });
  const approve = async () => {
    await bridge.request(request('get_page_context'));
    expect(await bridge.approve(sessionId)).toBe(true);
  };
  return {
    bridge,
    adapter,
    context,
    enabled,
    allowProduction,
    publish,
    sessionId,
    request,
    approve,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
describe('local MCP authorization', () => {
  it('denies every tool and resource before approval without performing data reads', async () => {
    const s = setup();
    const fields = vi.spyOn(s.adapter, 'getRecordFields');
    const sql = vi.spyOn(s.adapter, 'runSuiteQL');
    const source = vi.spyOn(s.adapter, 'readImpactSource');
    for (const [tool, input] of Object.entries({
      get_page_context: {},
      get_record_schema: { recordType: 'salesorder' },
      get_automations: { recordType: 'salesorder' },
      run_suiteql: { sql: 'SELECT id FROM transaction' },
      where_used: { id: 'memo' },
      get_script_source: { scriptId: '101' },
      read_context: { recordType: 'salesorder' },
    })) {
      expect(await s.bridge.request(s.request(tool as ToolName, input))).toMatchObject({
        ok: false,
        error: 'NOT_AUTHORIZED',
      });
    }
    expect(fields).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
    expect(s.bridge.state.sessions).toHaveLength(1);
  });
  it('returns metadata without record values after sandbox approval', async () => {
    const s = setup();
    await s.approve();
    const answer = await s.bridge.request(
      s.request('get_record_schema', { recordType: 'salesorder' }),
    );
    expect(answer?.ok).toBe(true);
    const data = JSON.stringify(answer);
    expect(data).toContain('memo');
    expect(data).not.toContain('"value"');
    expect(data).not.toContain('"url"');
    expect(s.bridge.state.log.at(-1)).toMatchObject({
      tool: 'get_record_schema',
      outcome: 'ok',
      accountId: s.context.accountId,
    });
    expect(JSON.stringify(s.bridge.state.log)).not.toContain('memo');
  });
  it('requires production opt-in independent of environment override', async () => {
    const s = setup('production');
    await s.bridge.request(s.request('get_page_context'));
    expect(await s.bridge.approve(s.sessionId)).toBe(false);
    s.allowProduction.mockResolvedValue(true);
    expect(await s.bridge.approve(s.sessionId)).toBe(true);
    s.allowProduction.mockResolvedValue(false);
    expect(await s.bridge.request(s.request('get_page_context'))).toMatchObject({
      error: 'NOT_AUTHORIZED',
    });
  });
  it('revokes on expiry, safe mode, denial and disconnect', async () => {
    for (const revoke of ['expiry', 'safe', 'deny', 'disconnect']) {
      const s = setup();
      await s.approve();
      if (revoke === 'expiry') s.advance(APPROVAL_MS);
      if (revoke === 'safe') s.enabled.mockResolvedValue(false);
      if (revoke === 'deny') await s.bridge.deny(s.sessionId);
      if (revoke === 'disconnect') await s.bridge.disconnect();
      expect(await s.bridge.request(s.request('get_page_context'))).toMatchObject({
        ok: false,
        error: 'NOT_AUTHORIZED',
      });
    }
  });
  it('discards reads completed after page/account navigation', async () => {
    const s = setup();
    await s.approve();
    vi.spyOn(s.adapter, 'getRecordFields').mockImplementation(async () => {
      vi.mocked(s.adapter.getPageContext).mockResolvedValue({
        ...s.context,
        accountId: '7654321-sb1',
      });
      return {
        accountId: s.context.accountId,
        recordType: 'salesorder',
        sources: [],
        fetchedAt: 1,
        fields: [],
        sublists: [],
        warnings: [],
      };
    });
    expect(
      await s.bridge.request(s.request('get_record_schema', { recordType: 'salesorder' })),
    ).toMatchObject({ ok: false });
  });
  it('bounds query rows, validates parameters and logs only metadata', async () => {
    const s = setup();
    await s.approve();
    const run = vi
      .spyOn(s.adapter, 'runSuiteQL')
      .mockResolvedValue({ accountId: s.context.accountId, rows: [{ id: 1 }], atLimit: true });
    expect(
      await s.bridge.request(
        s.request('run_suiteql', {
          sql: 'SELECT id FROM transaction WHERE id = ?',
          params: [1],
          limit: 1,
        }),
      ),
    ).toMatchObject({ ok: true });
    expect(run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxRows: 1, params: [1] }),
    );
    expect(
      await s.bridge.request(
        s.request('run_suiteql', { sql: 'SELECT id FROM transaction WHERE id = ?', params: [] }),
      ),
    ).toMatchObject({ ok: false });
    expect(run).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(s.bridge.state.log)).not.toContain('SELECT');
    await s.bridge.clearLog();
    expect(s.bridge.state.log).toEqual([]);
  });
  it('rejects writes, multiple statements, unsupported tools and excessive caps', async () => {
    const s = setup();
    await s.approve();
    const run = vi.spyOn(s.adapter, 'runSuiteQL');
    for (const sql of [
      'DELETE FROM transaction',
      'UPDATE transaction SET id=1',
      'SELECT 1; DELETE FROM transaction',
      'WITH x AS (DELETE FROM transaction) SELECT * FROM x',
    ]) {
      expect(ToolInputs.run_suiteql.safeParse({ sql }).success).toBe(false);
      expect(await s.bridge.request(s.request('run_suiteql', { sql }))).toBeUndefined();
    }
    expect(
      await s.bridge.request(s.request('run_suiteql', { sql: 'SELECT 1', limit: 1001 })),
    ).toBeUndefined();
    expect(
      await s.bridge.request({ ...s.request('get_page_context'), tool: 'call_restlet' }),
    ).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
  });
  it('limits concurrent requests and per-session request rate', async () => {
    const s = setup();
    await s.approve();
    for (let n = 0; n < 20; n++)
      expect((await s.bridge.request(s.request('get_page_context')))?.ok).toBe(true);
    expect(await s.bridge.request(s.request('get_page_context'))).toMatchObject({
      error: 'RATE_LIMIT',
    });
    s.advance(60_001);
    expect((await s.bridge.request(s.request('get_page_context')))?.ok).toBe(true);
  });
  it('discards in-flight results when approval is revoked', async () => {
    const s = setup();
    await s.approve();
    let finish!: (value: Awaited<ReturnType<typeof s.adapter.getRecordFields>>) => void;
    vi.spyOn(s.adapter, 'getRecordFields').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = s.bridge.request(s.request('get_record_schema', { recordType: 'salesorder' }));
    await vi.waitFor(() => expect(finish).toBeDefined());
    expect(await s.bridge.request(s.request('get_page_context'))).toMatchObject({ error: 'BUSY' });
    await s.bridge.deny(s.sessionId);
    finish({
      accountId: s.context.accountId,
      recordType: 'salesorder',
      sources: [],
      fetchedAt: 1,
      fields: [],
      sublists: [],
      warnings: [],
    });
    expect(await pending).toMatchObject({ ok: false });
  });
  it('resolves a script record to its file, never treating a script ID as a file ID', async () => {
    const s = setup();
    await s.approve();
    const run = vi.spyOn(s.adapter, 'runSuiteQL').mockResolvedValue({
      accountId: s.context.accountId,
      rows: [{ id: 101, fileid: 555 }],
      atLimit: false,
    });
    const read = vi.spyOn(s.adapter, 'readImpactSource').mockResolvedValue({
      accountId: s.context.accountId,
      fileId: '555',
      source: 'script',
      url: s.context.url,
      content: "define([], () => 'fixture-only');",
    });
    const result = await s.bridge.request(s.request('get_script_source', { scriptId: '101' }));
    expect(result).toMatchObject({ ok: true, data: { scriptId: '101', fileId: '555' } });
    expect(run).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: [101] }),
    );
    expect(read).toHaveBeenCalledWith({
      accountId: s.context.accountId,
      fileId: '555',
      source: 'script',
    });
    expect(JSON.stringify(result)).not.toContain('url');
    expect(JSON.stringify(s.bridge.state.log)).not.toContain('fixture-only');
  });
  it('serves metadata-only resources through the same approved session', async () => {
    const s = setup();
    await s.approve();
    const result = await s.bridge.request(s.request('read_context', { recordType: 'salesorder' }));
    expect(result?.ok).toBe(true);
    if (!result?.ok) throw new Error('Expected resource');
    expect(result.data).toContain('NetSuite record type');
    expect(result.data).not.toContain(s.context.accountId);
    expect(result.data).not.toContain('SO-FAKE-1001');
  });
  it('keeps source text and raw error detail out of log and error replies', async () => {
    const s = setup();
    await s.approve();
    vi.spyOn(s.adapter, 'runSuiteQL').mockResolvedValue({
      accountId: s.context.accountId,
      rows: [{ id: 101, fileid: 555 }],
      atLimit: false,
    });
    const read = vi
      .spyOn(s.adapter, 'readImpactSource')
      .mockRejectedValue(new Error('PRIVATE-CLIENT-SOURCE'));
    const failure = await s.bridge.request(s.request('get_script_source', { scriptId: '101' }));
    expect(failure).toMatchObject({ error: 'READ_FAILED' });
    expect(JSON.stringify([failure, s.bridge.state])).not.toContain('PRIVATE-CLIENT-SOURCE');
    read.mockResolvedValue({
      accountId: s.context.accountId,
      fileId: '555',
      source: 'script',
      url: s.context.url,
      content: 'x'.repeat(900_000),
    });
    expect(
      await s.bridge.request(s.request('get_script_source', { scriptId: '101' })),
    ).toMatchObject({ error: 'TOO_LARGE' });
  });
  it('keeps bounded Impact results conservative and excludes source excerpts', async () => {
    const s = setup();
    await s.approve();
    const result = await s.bridge.request(s.request('where_used', { id: 'custbody_demo_ref' }));
    expect(result?.ok).toBe(true);
    if (!result?.ok) throw new Error('Expected reference scan');
    expect(result.data).toMatchObject({ coverage: 'text-only' });
    expect(JSON.stringify(result.data)).not.toContain('excerpt');
    expect(JSON.stringify(result.data)).toContain('possible');
  });
  it('supports script IDs and supplies only observed folder metadata to the source adapter', async () => {
    const s = setup();
    await s.approve();
    const run = vi.spyOn(s.adapter, 'runSuiteQL').mockImplementation(async (sql) => ({
      accountId: s.context.accountId,
      atLimit: false,
      rows: sql.includes('FROM script')
        ? [{ id: 101, scriptid: 'customscript_fixture', fileid: 555 }]
        : [{ id: 555, name: 'fixture.js', folder: 77 }],
    }));
    const read = vi.spyOn(s.adapter, 'readImpactSource').mockResolvedValue({
      accountId: s.context.accountId,
      fileId: '555',
      source: 'script',
      url: s.context.url,
      content: 'fixture source',
    });
    expect(
      await s.bridge.request(s.request('get_script_source', { scriptId: 'customscript_fixture' })),
    ).toMatchObject({ ok: true });
    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('WHERE scriptid = ?'),
      expect.objectContaining({ params: ['customscript_fixture'] }),
    );
    expect(read).toHaveBeenCalledWith({
      accountId: s.context.accountId,
      fileId: '555',
      source: 'script',
      folderId: '77',
    });
  });
});
