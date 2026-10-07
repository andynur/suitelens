import { z } from 'zod';
import { SuiteLensError } from '../errors';
import type { NetSuiteAdapter } from '../adapter/NetSuiteAdapter';

export const EXECUTION_LOG_LIMIT = 1000;
// ScriptNote fields confirmed in sandbox Records Catalog: internalId, date, type,
// title, detail, scriptType. Its primary key is internalId, not id.
// VERIFY: Script join, returned raw type values and timestamp timezone per account/role.
// Do not infer a deployment by joining on its script: one script can have many deployments.
export const EXECUTION_LOGS_SQL = `SELECT
  n.internalid AS id, TO_CHAR(n.date, 'YYYY-MM-DD HH24:MI:SS') AS loggedat,
  n.type AS level, n.title AS title, n.detail AS detail,
  n.scripttype AS scriptinternalid, s.scriptid AS scriptid,
  NULL AS deploymentinternalid, NULL AS deploymentid
FROM ScriptNote n
LEFT JOIN script s ON s.id = n.scripttype
ORDER BY n.date DESC, n.internalid DESC`;
const id = z
  .union([z.string(), z.number().int().positive()])
  .transform(String)
  .pipe(z.string().regex(/^[1-9]\d{0,17}$/));
export const ExecutionLogRowSchema = z.object({
  id,
  loggedat: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  level: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(['DEBUG', 'AUDIT', 'ERROR', 'EMERGENCY'])),
  title: z
    .string()
    .max(1000)
    .nullable()
    .transform((v) => v ?? ''),
  detail: z
    .string()
    .max(100000)
    .nullable()
    .transform((v) => v ?? ''),
  scriptinternalid: id.nullable(),
  scriptid: z.string().max(1000).nullable(),
  deploymentinternalid: id.nullable(),
  deploymentid: z.string().max(1000).nullable(),
});
export type ExecutionLog = z.infer<typeof ExecutionLogRowSchema>;
export function mapExecutionLogs(rows: unknown[]): ExecutionLog[] {
  const parsed = z.array(ExecutionLogRowSchema).max(EXECUTION_LOG_LIMIT).safeParse(rows);
  if (!parsed.success)
    throw new SuiteLensError(
      'INVALID_RESPONSE',
      'Unexpected execution log columns. Verify ScriptNote columns, level values and role visibility in the account Records Catalog.',
    );
  const seen = new Set<string>();
  for (const row of parsed.data) {
    if (seen.has(row.id))
      throw new SuiteLensError('INVALID_RESPONSE', 'Duplicate execution log IDs.');
    seen.add(row.id);
  }
  return parsed.data;
}
export async function loadExecutionLogs(
  adapter: NetSuiteAdapter,
  accountId: string,
  signal?: AbortSignal,
) {
  let result: Awaited<ReturnType<NetSuiteAdapter['runSuiteQL']>>;
  try {
    result = await adapter.runSuiteQL(EXECUTION_LOGS_SQL, {
      accountId,
      signal,
      maxRows: EXECUTION_LOG_LIMIT,
    });
  } catch (error) {
    if (
      error instanceof SuiteLensError &&
      ['QUERY_FAILED', 'TABLE_UNAVAILABLE', 'PERMISSION_DENIED'].includes(error.code)
    )
      throw new SuiteLensError(
        error.code,
        error.message,
        `${error.detail ?? error.message} Verify ScriptNote fields (internalid, date, type, title, detail, scripttype), Script visibility and Setup > SuiteScript (View or higher) for the current role. Records Catalog access is a separate permission.`,
      );
    throw error;
  }
  if (signal?.aborted) throw new SuiteLensError('CANCELLED', 'Log request cancelled.');
  if (result.accountId !== accountId)
    throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed while loading logs.');
  return { items: mapExecutionLogs(result.rows), limited: result.atLimit };
}
