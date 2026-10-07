import { z } from 'zod';
import { SuiteLensError } from '../errors';
import { throwIfCancelled, type ConsoleOptions, type ConsoleResult } from './console';

export const RESTLET_LIST_LIMIT = 1000;

// VERIFY: script.scripttype RESTLET value, join, columns and role visibility in the account
// Records Catalog. Oracle Analytics Browser documents scriptdeployment.primarykey/scriptid.
export const RESTLET_DEPLOYMENTS_SQL = `SELECT
  s.id AS scriptinternalid, s.scriptid AS scriptid, s.name AS scriptname,
  s.scripttype AS scripttype, s.isinactive AS scriptinactive,
  d.primarykey AS deploymentinternalid, d.scriptid AS deploymentid,
  d.status AS status, d.isdeployed AS isdeployed
FROM scriptdeployment d
INNER JOIN script s ON s.id = d.script
WHERE s.scripttype = 'RESTLET'
ORDER BY d.primarykey`;

const id = z
  .union([z.string(), z.number().int().positive()])
  .transform(String)
  .pipe(z.string().regex(/^[1-9]\d{0,17}$/));
const text = z.string().min(1).max(1000);
const flag = z
  .union([z.boolean(), z.enum(['T', 'F', 'true', 'false', '1', '0']), z.literal(0), z.literal(1)])
  .transform(
    (value) => value === true || value === 'T' || value === 'true' || value === '1' || value === 1,
  );
export const RestletDeploymentRowSchema = z.object({
  scriptinternalid: id,
  scriptid: text,
  scriptname: text.nullable(),
  scripttype: text,
  scriptinactive: flag,
  deploymentinternalid: id,
  deploymentid: text,
  status: text.nullable(),
  isdeployed: flag,
});
export type RestletDeployment = {
  scriptInternalId: string;
  scriptId: string;
  name: string;
  deploymentInternalId: string;
  deploymentId: string;
  status: string | null;
  inactive: boolean;
  deployed: boolean;
};

export function mapRestletDeployments(rows: unknown[]): RestletDeployment[] {
  const items = new Map<string, RestletDeployment>();
  for (const raw of rows) {
    const parsed = RestletDeploymentRowSchema.safeParse(raw);
    if (!parsed.success || parsed.data.scripttype.toUpperCase() !== 'RESTLET')
      throw new SuiteLensError(
        'INVALID_RESPONSE',
        'Unexpected RESTlet deployment columns.',
        'Verify RESTlet script type values and deployment columns in the account Records Catalog.',
      );
    const row = parsed.data;
    const item = {
      scriptInternalId: row.scriptinternalid,
      scriptId: row.scriptid,
      name: row.scriptname ?? row.scriptid,
      deploymentInternalId: row.deploymentinternalid,
      deploymentId: row.deploymentid,
      status: row.status,
      inactive: row.scriptinactive,
      deployed: row.isdeployed,
    };
    const previous = items.get(item.deploymentInternalId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item))
      throw new SuiteLensError('INVALID_RESPONSE', 'Conflicting RESTlet deployment rows.');
    items.set(item.deploymentInternalId, item);
  }
  return [...items.values()].sort(
    (a, b) =>
      Number(a.inactive || !a.deployed) - Number(b.inactive || !b.deployed) ||
      a.name.localeCompare(b.name) ||
      a.deploymentId.localeCompare(b.deploymentId) ||
      a.deploymentInternalId.localeCompare(b.deploymentInternalId),
  );
}

export async function loadRestletDeployments(
  run: (sql: string, options: ConsoleOptions) => Promise<ConsoleResult>,
  options: Pick<ConsoleOptions, 'accountId' | 'signal'>,
) {
  throwIfCancelled(options.signal);
  const result = await run(RESTLET_DEPLOYMENTS_SQL, { ...options, maxRows: RESTLET_LIST_LIMIT });
  throwIfCancelled(options.signal);
  if (result.accountId !== options.accountId)
    throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed while loading RESTlets.');
  return { items: mapRestletDeployments(result.rows), limited: result.atLimit };
}
