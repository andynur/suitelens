import { classifySuiteQLError, LoupeError, toLoupeError } from '../errors';
import type { BridgeField, CurrentRecordFields } from '../parsers/mergeFields';
import { isSensitiveFieldId } from '../parsers/sensitiveFields';
import { AUTOMATION_QUERIES } from '../queries/automation';
import { resolveQuerySql } from '../queries/runner';
import type { BridgeOp, Result } from './protocol';

/**
 * Bridge operation handlers. Runs in the page's MAIN world and talks to NetSuite only
 * through the page's own AMD `require` (user's session and permissions).
 *
 * Fixed allow-list: the operations below. No eval, no arbitrary SQL — `runSuiteQL` only
 * accepts IDs of queries defined in src/netsuite/queries.
 */

export type AmdRequire = (
  deps: string[],
  callback: (...modules: unknown[]) => void,
  errback?: (err: unknown) => void,
) => void;

export type PageGlobals = {
  require?: unknown;
  nlapiGetRecordType?: unknown;
  nlapiGetRecordId?: unknown;
};

export type BridgeHandlerOptions = {
  globals: PageGlobals;
  moduleTimeoutMs?: number;
  maxRows?: number;
};

const MAX_VALUE_LENGTH = 2000;

export function createBridgeHandler(options: BridgeHandlerOptions) {
  const { globals, moduleTimeoutMs = 10_000, maxRows = 5000 } = options;

  const getRequire = (): AmdRequire => {
    if (typeof globals.require !== 'function') {
      throw new LoupeError(
        'REQUIRE_UNAVAILABLE',
        "NetSuite's module loader is not available on this page.",
      );
    }
    return globals.require as AmdRequire;
  };

  // VERIFY: NetSuite's AMD loader calls the errback when a module is unavailable.
  const loadModule = (name: string): Promise<unknown> => {
    const req = getRequire();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new LoupeError('TIMEOUT', `Loading ${name} timed out.`)),
        moduleTimeoutMs,
      );
      try {
        req(
          [name],
          (mod) => {
            clearTimeout(timer);
            if (mod) resolve(mod);
            else
              reject(
                new LoupeError('MODULE_UNAVAILABLE', `${name} is not available on this page.`),
              );
          },
          (err) => {
            clearTimeout(timer);
            reject(
              new LoupeError(
                'MODULE_UNAVAILABLE',
                `${name} is not available on this page.`,
                errText(err),
              ),
            );
          },
        );
      } catch (err) {
        clearTimeout(timer);
        reject(
          new LoupeError(
            'MODULE_UNAVAILABLE',
            `${name} is not available on this page.`,
            errText(err),
          ),
        );
      }
    });
  };

  const getCurrentRecord = async (): Promise<CurrentRecordLike> => {
    const mod = (await loadModule('N/currentRecord')) as { get?: () => unknown };
    if (typeof mod.get !== 'function') {
      throw new LoupeError('MODULE_UNAVAILABLE', 'N/currentRecord.get is not available.');
    }
    try {
      return mod.get() as CurrentRecordLike;
    } catch (err) {
      throw new LoupeError(
        'MODULE_UNAVAILABLE',
        'The current record is not available on this page.',
        errText(err),
      );
    }
  };

  const ops = {
    async ping() {
      return { requireAvailable: typeof globals.require === 'function' };
    },

    async getRecordType() {
      try {
        const rec = await getCurrentRecord();
        return { recordType: asString(rec.type) ?? null, recordId: asString(rec.id) ?? null };
      } catch {
        // VERIFY: SuiteScript 1.0 globals exist on record pages.
        return {
          recordType: callGlobal(globals.nlapiGetRecordType) ?? null,
          recordId: callGlobal(globals.nlapiGetRecordId) ?? null,
        };
      }
    },

    async getCurrentRecordFields(op: Extract<BridgeOp, { op: 'getCurrentRecordFields' }>) {
      return describeRecord(await getCurrentRecord(), op);
    },

    /**
     * View mode: N/currentRecord reports the rendered type ("text" for a select), so field
     * metadata comes from a read-only `record.load`. Never saves.
     * VERIFY: N/record is loadable on view pages, `load.promise` exists, and loading does
     * not run beforeLoad user event scripts with side effects.
     */
    async getLoadedRecordFields(op: Extract<BridgeOp, { op: 'getLoadedRecordFields' }>) {
      const mod = (await loadModule('N/record')) as RecordModule;
      if (typeof mod.load !== 'function') {
        throw new LoupeError('MODULE_UNAVAILABLE', 'N/record.load is not available.');
      }
      const options = { type: op.recordType, id: op.recordId, isDynamic: false };
      let rec: CurrentRecordLike;
      try {
        rec =
          typeof mod.load.promise === 'function'
            ? await mod.load.promise(options)
            : mod.load(options);
      } catch (err) {
        throw new LoupeError(
          'MODULE_UNAVAILABLE',
          'The record could not be loaded through N/record.',
          errText(err),
        );
      }
      return describeRecord(rec, op);
    },

    async runSuiteQL(op: Extract<BridgeOp, { op: 'runSuiteQL' }>) {
      const sql = resolveQuerySql(AUTOMATION_QUERIES, op.queryId, op.variantId);
      if (!sql) throw new LoupeError('UNSUPPORTED', 'Unknown query.');
      const query = (await loadModule('N/query')) as QueryModule;
      if (typeof query.runSuiteQL !== 'function') {
        throw new LoupeError('MODULE_UNAVAILABLE', 'N/query.runSuiteQL is not available.');
      }
      try {
        // VERIFY: `runSuiteQL.promise` exists in client context; fall back to the sync call.
        const run = query.runSuiteQL;
        const resultSet =
          typeof run.promise === 'function'
            ? await run.promise({ query: sql })
            : run({ query: sql });
        const rows = resultSet.asMappedResults();
        return rows.slice(0, maxRows);
      } catch (err) {
        const text = errText(err);
        throw new LoupeError(classifySuiteQLError(text), 'The SuiteQL query failed.', text);
      }
    },
  };

  return async function handle(op: BridgeOp): Promise<Result<unknown>> {
    try {
      switch (op.op) {
        case 'ping':
          return { ok: true, data: await ops.ping() };
        case 'getRecordType':
          return { ok: true, data: await ops.getRecordType() };
        case 'getCurrentRecordFields':
          return { ok: true, data: await ops.getCurrentRecordFields(op) };
        case 'getLoadedRecordFields':
          return { ok: true, data: await ops.getLoadedRecordFields(op) };
        case 'runSuiteQL':
          return { ok: true, data: await ops.runSuiteQL(op) };
      }
    } catch (err) {
      return { ok: false, error: toLoupeError(err).toShape() };
    }
  };
}

type FieldLike = {
  label?: unknown;
  type?: unknown;
  isMandatory?: unknown;
  isDisabled?: unknown;
  isDisplay?: unknown;
  isVisible?: unknown;
};

type CurrentRecordLike = {
  type?: unknown;
  id?: unknown;
  getField?: (o: { fieldId: string }) => unknown;
  getValue?: (o: { fieldId: string }) => unknown;
  getText?: (o: { fieldId: string }) => unknown;
  getLineCount?: (o: { sublistId: string }) => unknown;
  getSublistField?: (o: { sublistId: string; fieldId: string; line: number }) => unknown;
};

type RecordLoadOptions = { type: string; id: string; isDynamic: boolean };
type RecordModule = {
  load?: ((o: RecordLoadOptions) => CurrentRecordLike) & {
    promise?: (o: RecordLoadOptions) => Promise<CurrentRecordLike>;
  };
};

type QueryModule = {
  runSuiteQL: ((o: { query: string }) => ResultSetLike) & {
    promise?: (o: { query: string }) => Promise<ResultSetLike>;
  };
};
type ResultSetLike = { asMappedResults: () => Record<string, unknown>[] };

type FieldsRequest = {
  fieldIds: readonly string[];
  sublists: readonly { id: string; fieldIds: readonly string[] }[];
};

/** Field metadata and values of a current or loaded record. Token fields are never read. */
function describeRecord(rec: CurrentRecordLike, op: FieldsRequest): CurrentRecordFields {
  const result: CurrentRecordFields = { fields: [], sublists: [] };
  const type = asString(rec.type);
  const id = asString(rec.id);
  if (type) result.recordType = type;
  if (id) result.recordId = id;

  for (const fieldId of op.fieldIds) {
    // Never read token fields, even when asked (see sensitiveFields.ts).
    if (isSensitiveFieldId(fieldId)) continue;
    const field = safe(() => rec.getField?.({ fieldId }));
    const info = describeField(fieldId, field);
    const value = stringifyValue(safe(() => rec.getValue?.({ fieldId })));
    const text = stringifyValue(safe(() => rec.getText?.({ fieldId })));
    if (value !== undefined) info.value = value;
    if (text !== undefined) info.text = text;
    result.fields.push(info);
  }

  for (const sublist of op.sublists) {
    const lineCount = Number(safe(() => rec.getLineCount?.({ sublistId: sublist.id })) ?? 0);
    const fields: BridgeField[] = [];
    for (const fieldId of sublist.fieldIds) {
      if (isSensitiveFieldId(fieldId)) continue;
      const field =
        lineCount > 0
          ? safe(() => rec.getSublistField?.({ sublistId: sublist.id, fieldId, line: 0 }))
          : undefined;
      fields.push(describeField(fieldId, field));
    }
    result.sublists.push({ id: sublist.id, lineCount: lineCount > 0 ? lineCount : 0, fields });
  }
  return result;
}

// VERIFY: Field object property names (label, type, isMandatory, isDisabled, isDisplay, isVisible).
function describeField(fieldId: string, raw: unknown): BridgeField {
  const info: BridgeField = { id: fieldId };
  if (!raw || typeof raw !== 'object') return info;
  const f = raw as FieldLike;
  const label = asString(f.label);
  const type = asString(f.type);
  if (label) info.label = label;
  if (type) info.type = type;
  if (typeof f.isMandatory === 'boolean') info.mandatory = f.isMandatory;
  if (typeof f.isDisabled === 'boolean') info.disabled = f.isDisabled;
  if (f.isDisplay === false || f.isVisible === false) info.hidden = true;
  else if (f.isDisplay === true || f.isVisible === true) info.hidden = false;
  return info;
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v !== '') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function callGlobal(fn: unknown): string | undefined {
  if (typeof fn !== 'function') return undefined;
  return asString(safe(() => (fn as () => unknown)()));
}

export function stringifyValue(v: unknown): string | undefined {
  let out: string | undefined;
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') out = v;
  else if (typeof v === 'number' || typeof v === 'boolean') out = String(v);
  else if (v instanceof Date) out = Number.isNaN(v.getTime()) ? undefined : v.toISOString();
  else if (Array.isArray(v)) out = v.map((x) => stringifyValue(x) ?? '').join(', ');
  if (out === undefined) return undefined;
  return out.length > MAX_VALUE_LENGTH ? `${out.slice(0, MAX_VALUE_LENGTH)}…` : out;
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err)
    return String((err as { message: unknown }).message);
  return String(err);
}
