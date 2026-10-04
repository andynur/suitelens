import { SuiteLensError, toSuiteLensError } from '../errors';
import type { AutomationResult } from '../types';
import {
  mapScriptDeploymentRows,
  mapWorkflowRows,
  SCRIPT_DEPLOYMENTS_QUERY,
  sortAutomations,
  WORKFLOWS_QUERY,
  type AutomationQueryId,
  type QueryDefinition,
} from './automation';

/** Executes one allow-listed query variant and returns its mapped rows. */
export type RunQueryVariant = (queryId: AutomationQueryId, variantId: string) => Promise<unknown[]>;

/** Warning codes; the UI translates them (shared/i18n). */
export const AUTOMATION_WARNINGS = {
  scriptsUnavailable: 'automation.scripts_unavailable',
  workflowsUnavailable: 'automation.workflows_unavailable',
  reducedColumns: 'automation.reduced_columns',
} as const;

/** Errors that will not go away by trying a smaller variant. */
const NO_FALLBACK = new Set([
  'PERMISSION_DENIED',
  'TIMEOUT',
  'REQUIRE_UNAVAILABLE',
  'MODULE_UNAVAILABLE',
  'BRIDGE_UNAVAILABLE',
  'NO_CONTENT_SCRIPT',
]);

export async function runWithFallback(
  def: QueryDefinition,
  run: RunQueryVariant,
): Promise<{ rows: unknown[]; variantId: string; reduced: boolean }> {
  let lastError: SuiteLensError | undefined;
  for (const [index, variant] of def.variants.entries()) {
    try {
      const rows = await run(def.id, variant.id);
      return { rows, variantId: variant.id, reduced: index > 0 };
    } catch (err) {
      lastError = toSuiteLensError(err);
      if (NO_FALLBACK.has(lastError.code)) throw lastError;
    }
  }
  throw lastError ?? new SuiteLensError('QUERY_FAILED', `Query ${def.id} has no variants`);
}

export async function loadAutomations(
  accountId: string,
  recordType: string,
  run: RunQueryVariant,
  now: () => number = Date.now,
): Promise<AutomationResult> {
  const [scripts, workflows] = await Promise.allSettled([
    runWithFallback(SCRIPT_DEPLOYMENTS_QUERY, run),
    runWithFallback(WORKFLOWS_QUERY, run),
  ]);

  if (scripts.status === 'rejected' && workflows.status === 'rejected') {
    throw toSuiteLensError(scripts.reason);
  }

  const warnings: string[] = [];
  const items = [];
  let complete = true;

  if (scripts.status === 'fulfilled') {
    items.push(...mapScriptDeploymentRows(scripts.value.rows, recordType));
    if (scripts.value.reduced) {
      complete = false;
      warnings.push(AUTOMATION_WARNINGS.reducedColumns);
    }
  } else {
    complete = false;
    warnings.push(AUTOMATION_WARNINGS.scriptsUnavailable);
  }

  if (workflows.status === 'fulfilled') {
    items.push(...mapWorkflowRows(workflows.value.rows, recordType));
    if (workflows.value.reduced && !warnings.includes(AUTOMATION_WARNINGS.reducedColumns)) {
      complete = false;
      warnings.push(AUTOMATION_WARNINGS.reducedColumns);
    }
  } else {
    complete = false;
    warnings.push(AUTOMATION_WARNINGS.workflowsUnavailable);
  }

  return {
    accountId,
    recordType,
    items: sortAutomations(items),
    // Execution order inside each group is never fully known from SuiteQL in v0.1.
    complete,
    warnings,
    fetchedAt: now(),
  };
}

/** Looks up the SQL for an allow-listed query variant (used by the bridge). */
export function resolveQuerySql(
  defs: Readonly<Record<string, QueryDefinition>>,
  queryId: string,
  variantId: string,
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(defs, queryId)) return undefined;
  return defs[queryId]?.variants.find((v) => v.id === variantId)?.sql;
}
