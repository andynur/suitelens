import { z } from 'zod';
import { SuiteLensError } from '../errors';

// VERIFY: Script.id/scriptid/scriptfile role visibility varies. Reuse the observed Script columns;
// never confuse a script internal ID with a File Cabinet file ID or guess a download URL.
export const MCP_SCRIPT_SOURCE_SQL =
  'SELECT id AS id, scriptid AS scriptid, scriptfile AS fileid FROM script WHERE id = ?';
export const MCP_SCRIPT_SOURCE_BY_NAME_SQL =
  'SELECT id AS id, scriptid AS scriptid, scriptfile AS fileid FROM script WHERE scriptid = ?';
const RowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  scriptid: z.string().optional(),
  fileid: z.union([z.string(), z.number()]),
});
export function mapMcpScriptFile(rows: readonly unknown[], scriptId: string): string {
  if (rows.length !== 1)
    throw new SuiteLensError(
      'UNSUPPORTED',
      'Script source metadata is not available to this role.',
    );
  const row = RowSchema.parse(rows[0]);
  const matches = /^customscript_/.test(scriptId)
    ? row.scriptid === scriptId
    : String(row.id) === scriptId;
  if (!matches || !/^[1-9][0-9]{0,19}$/.test(String(row.fileid)))
    throw new SuiteLensError(
      'INVALID_RESPONSE',
      'Script source metadata did not match the requested script.',
    );
  return String(row.fileid);
}
