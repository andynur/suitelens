import { describe, expect, it } from 'vitest';
import rows from '../../../fixtures/mcp/script-file.json';
import {
  MCP_SCRIPT_SOURCE_SQL,
  MCP_SCRIPT_SOURCE_BY_NAME_SQL,
  mapMcpScriptFile,
} from './mcpScript';
import { isReadOnlyQuery } from './console';

describe('MCP script source metadata', () => {
  it('uses a bound read and maps script internal ID to its distinct file ID', () => {
    expect(isReadOnlyQuery(MCP_SCRIPT_SOURCE_SQL)).toBe(true);
    expect(mapMcpScriptFile(rows, '101')).toBe('555');
    expect(mapMcpScriptFile(rows, 'customscript_suitelens_fixture')).toBe('555');
    expect(isReadOnlyQuery(MCP_SCRIPT_SOURCE_BY_NAME_SQL)).toBe(true);
    expect(() => mapMcpScriptFile(rows, 'customscript_wrong')).toThrow();
  });
  it('rejects missing, ambiguous, mismatched and malformed metadata', () => {
    for (const data of [
      [],
      [...rows, ...rows],
      [{ id: 102, fileid: 555 }],
      [{ id: 101, fileid: -1 }],
    ])
      expect(() => mapMcpScriptFile(data, '101')).toThrow();
  });
});
