import { z } from 'zod';
import { findMappingByType } from '../context/recordTypeMap';
import type { AutomationItem, AutomationKind } from '../types';

/**
 * Automation Map queries (F-1.12 – F-1.17).
 *
 * VERIFY in Records Catalog / account: every table and column below. SuiteQL metadata
 * tables are not fully documented and vary between accounts and releases.
 *
 * Strategy: each query has ordered variants, richest first. The runner tries them in order
 * and falls back to the next variant when NetSuite rejects a column. Record-type filtering
 * happens in the mapper (not in SQL) because the stored record type value format
 * (e.g. "SALESORDER" vs internal ID) is unconfirmed.
 */

export type QueryVariant = {
  /** Stable ID used in logs/fixtures. */
  id: string;
  sql: string;
  /** Columns this variant provides beyond the base variant (for completeness reporting). */
  optionalColumns: readonly string[];
};

export type QueryDefinition = {
  id: AutomationQueryId;
  variants: readonly QueryVariant[];
};

export const AUTOMATION_QUERY_IDS = [
  'automation.scriptDeployments',
  'automation.workflows',
] as const;
export type AutomationQueryId = (typeof AUTOMATION_QUERY_IDS)[number];

/** Script types shown in v0.1. VERIFY: `script.scripttype` values. */
export const SCRIPT_TYPE_KIND: Readonly<Record<string, AutomationKind>> = {
  CLIENT: 'client',
  USEREVENT: 'user_event',
  ACTION: 'workflow_action',
  WORKFLOWACTION: 'workflow_action',
};

// VERIFY: script / scriptdeployment tables and every column below.
export const SCRIPT_DEPLOYMENTS_QUERY: QueryDefinition = {
  id: 'automation.scriptDeployments',
  variants: [
    {
      id: 'full',
      optionalColumns: ['loglevel', 'scriptfilename', 'executioncontext'],
      sql: `SELECT
  s.id AS scriptinternalid,
  s.scriptid AS scriptid,
  s.name AS scriptname,
  s.scripttype AS scripttype,
  s.isinactive AS scriptinactive,
  s.scriptfile AS scriptfile,
  BUILTIN.DF(s.scriptfile) AS scriptfilename,
  d.primarykey AS deploymentinternalid,
  d.scriptid AS deploymentid,
  d.recordtype AS recordtype,
  BUILTIN.DF(d.recordtype) AS recordtypename,
  d.status AS status,
  d.isdeployed AS isdeployed,
  d.loglevel AS loglevel,
  d.executioncontext AS executioncontext
FROM scriptdeployment d
INNER JOIN script s ON s.id = d.script
WHERE s.scripttype IN ('CLIENT', 'USEREVENT', 'ACTION', 'WORKFLOWACTION')`,
    },
    {
      id: 'base',
      optionalColumns: [],
      sql: `SELECT
  s.id AS scriptinternalid,
  s.scriptid AS scriptid,
  s.name AS scriptname,
  s.scripttype AS scripttype,
  s.scriptfile AS scriptfile,
  d.primarykey AS deploymentinternalid,
  d.scriptid AS deploymentid,
  d.recordtype AS recordtype,
  d.status AS status,
  d.isdeployed AS isdeployed
FROM scriptdeployment d
INNER JOIN script s ON s.id = d.script
WHERE s.scripttype IN ('CLIENT', 'USEREVENT', 'ACTION', 'WORKFLOWACTION')`,
    },
  ],
};

// VERIFY: workflow table and columns (record type column name, release status, triggers).
export const WORKFLOWS_QUERY: QueryDefinition = {
  id: 'automation.workflows',
  variants: [
    {
      id: 'full',
      optionalColumns: ['releasestatus', 'inittriggertype'],
      sql: `SELECT
  w.id AS id,
  w.scriptid AS scriptid,
  w.name AS name,
  w.recordtypes AS recordtype,
  BUILTIN.DF(w.recordtypes) AS recordtypename,
  w.releasestatus AS releasestatus,
  w.isinactive AS isinactive,
  w.inittriggertype AS inittriggertype
FROM workflow w`,
    },
    {
      id: 'base',
      optionalColumns: [],
      sql: `SELECT
  w.id AS id,
  w.scriptid AS scriptid,
  w.name AS name,
  w.recordtypes AS recordtype,
  w.isinactive AS isinactive
FROM workflow w`,
    },
  ],
};

export const AUTOMATION_QUERIES: Readonly<Record<AutomationQueryId, QueryDefinition>> = {
  'automation.scriptDeployments': SCRIPT_DEPLOYMENTS_QUERY,
  'automation.workflows': WORKFLOWS_QUERY,
};

// ---------------------------------------------------------------------------
// Result schemas. SuiteQL returns lowercase column names; values may be string, number,
// boolean or null depending on the column (VERIFY), so the schemas coerce loosely.
// ---------------------------------------------------------------------------

const looseString = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined || v === '' ? undefined : String(v)));

export const ScriptDeploymentRowSchema = z.object({
  scriptinternalid: looseString,
  scriptid: looseString,
  scriptname: looseString,
  scripttype: looseString,
  scriptinactive: looseString,
  scriptfile: looseString,
  scriptfilename: looseString,
  deploymentinternalid: looseString,
  deploymentid: looseString,
  recordtype: looseString,
  recordtypename: looseString,
  status: looseString,
  isdeployed: looseString,
  loglevel: looseString,
  executioncontext: looseString,
});
export type ScriptDeploymentRow = z.infer<typeof ScriptDeploymentRowSchema>;

export const WorkflowRowSchema = z.object({
  id: looseString,
  scriptid: looseString,
  name: looseString,
  recordtype: looseString,
  recordtypename: looseString,
  releasestatus: looseString,
  isinactive: looseString,
  inittriggertype: looseString,
});
export type WorkflowRow = z.infer<typeof WorkflowRowSchema>;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * True when a stored record type value (raw or display, possibly a comma list for
 * multi-select columns) refers to `recordType`. Compares against the SuiteScript ID and the
 * English label from the mapping table. VERIFY: actual stored value format.
 */
export function matchesRecordType(
  recordType: string,
  raw: string | undefined,
  display: string | undefined,
): boolean {
  const wanted = new Set([normalize(recordType)]);
  const label = findMappingByType(recordType)?.label;
  if (label) wanted.add(normalize(label));
  const candidates = [raw, display]
    .filter((v): v is string => !!v)
    .flatMap((v) => v.split(','))
    .map((v) => normalize(v))
    .filter(Boolean);
  return candidates.some((c) => wanted.has(c));
}

const truthy = (v: string | undefined): boolean | undefined =>
  v === undefined ? undefined : v === 'T' || v === 'true' || v === '1';

export function mapScriptDeploymentRows(rows: unknown[], recordType: string): AutomationItem[] {
  const items: AutomationItem[] = [];
  for (const raw of rows) {
    const parsed = ScriptDeploymentRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const row = parsed.data;
    const kind = row.scripttype ? SCRIPT_TYPE_KIND[row.scripttype.toUpperCase()] : undefined;
    if (!kind || !row.scriptinternalid) continue;
    if (!matchesRecordType(recordType, row.recordtype, row.recordtypename)) continue;
    const item: AutomationItem = {
      kind,
      name: row.scriptname ?? row.scriptid ?? row.scriptinternalid,
      internalId: row.scriptinternalid,
    };
    assign(item, 'scriptId', row.scriptid);
    assign(item, 'deploymentInternalId', row.deploymentinternalid);
    assign(item, 'deploymentId', row.deploymentid);
    assign(item, 'status', row.status);
    assign(item, 'logLevel', row.loglevel);
    assign(item, 'scriptFileId', row.scriptfile);
    assign(item, 'scriptFileName', row.scriptfilename);
    const deployed = truthy(row.isdeployed);
    if (deployed !== undefined) item.isDeployed = deployed;
    const inactive = truthy(row.scriptinactive);
    if (inactive !== undefined) item.isInactive = inactive;
    if (row.executioncontext) {
      item.executionContexts = row.executioncontext
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }
    items.push(item);
  }
  return items;
}

export function mapWorkflowRows(rows: unknown[], recordType: string): AutomationItem[] {
  const items: AutomationItem[] = [];
  for (const raw of rows) {
    const parsed = WorkflowRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const row = parsed.data;
    if (!row.id) continue;
    if (!matchesRecordType(recordType, row.recordtype, row.recordtypename)) continue;
    const item: AutomationItem = {
      kind: 'workflow',
      name: row.name ?? row.scriptid ?? row.id,
      internalId: row.id,
    };
    assign(item, 'scriptId', row.scriptid);
    assign(item, 'status', row.releasestatus);
    assign(item, 'trigger', row.inittriggertype);
    const inactive = truthy(row.isinactive);
    if (inactive !== undefined) item.isInactive = inactive;
    items.push(item);
  }
  return items;
}

function assign<K extends keyof AutomationItem>(
  item: AutomationItem,
  key: K,
  value: AutomationItem[K] | undefined,
): void {
  if (value !== undefined) item[key] = value;
}

// ---------------------------------------------------------------------------
// Ordering (F-1.14): Client → User Event → Workflow Action → Workflow.
// Within a group NetSuite's real execution order is not exposed by these queries, so items
// are sorted by name and the UI labels the order "approximate".
// ---------------------------------------------------------------------------

const KIND_ORDER: Readonly<Record<AutomationKind, number>> = {
  client: 0,
  user_event: 1,
  workflow_action: 2,
  workflow: 3,
};

export function sortAutomations(items: AutomationItem[]): AutomationItem[] {
  return [...items].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name),
  );
}
