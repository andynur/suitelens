import { z } from 'zod';

export const CONTEXT_SOURCE_BATCH = 100;
function placeholders(size: number): string {
  if (!Number.isInteger(size) || size < 1 || size > CONTEXT_SOURCE_BATCH)
    throw new Error('Invalid context metadata batch size.');
  return Array.from({ length: size }, () => '?').join(', ');
}

// VERIFY: standalone columns were manually probed in one sandbox; bound active-field
// lookups and restricted-role access still need integrated live validation (ADR 0045).
export function contextFieldsSql(size: number): string {
  return `SELECT scriptid, fieldtype, fieldvaluetype, fieldvaluetyperecord,
    BUILTIN.DF(fieldvaluetyperecord) AS source_label FROM customfield
    WHERE fieldtype IN ('BODY', 'COLUMN') AND UPPER(scriptid) IN (${placeholders(size)})
    ORDER BY scriptid`;
}
export function contextRecordNamesSql(size: number): string {
  return `SELECT skey, name FROM scriptrecordtype WHERE name IN (${placeholders(size)}) ORDER BY skey`;
}
export function contextCustomRecordsSql(size: number): string {
  return `SELECT internalid, scriptid FROM customrecordtype WHERE internalid IN (${placeholders(size)}) ORDER BY internalid`;
}

const identifier = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,99}$/i)
  .transform((v) => v.toLowerCase());
const numericId = z
  .union([z.number(), z.string().regex(/^-?\d+$/)])
  .transform(Number)
  .pipe(z.number().int().safe());
const fieldSchema = z.object({
  scriptid: identifier,
  fieldtype: z.enum(['BODY', 'COLUMN']),
  fieldvaluetype: z.string(),
  fieldvaluetyperecord: numericId.nullable(),
  source_label: z.string().max(500).nullable(),
});
const nameSchema = z.object({ skey: identifier, name: z.string().max(500) });
const customSchema = z.object({
  internalid: numericId,
  scriptid: identifier.refine((v) => v.startsWith('customrecord_')),
});
export const mapContextFields = (rows: unknown[]) => z.array(fieldSchema).parse(rows);
export const mapContextRecordNames = (rows: unknown[]) => z.array(nameSchema).parse(rows);
export const mapContextCustomRecords = (rows: unknown[]) => z.array(customSchema).parse(rows);

export type ContextListSource = {
  listSource?: string;
  listSourceLabel?: string;
  listSourceStatus: 'resolved' | 'ambiguous' | 'unmapped';
  listSourceBasis?: 'custom-record-id' | 'unique-display-name';
};

/** Never resolve a positive ID by name: it can denote a custom list, not a record. */
export function resolveContextSources(
  fields: ReturnType<typeof mapContextFields>,
  names: ReturnType<typeof mapContextRecordNames>,
  records: ReturnType<typeof mapContextCustomRecords>,
): Record<string, ContextListSource> {
  const out: Record<string, ContextListSource> = {};
  for (const field of fields) {
    if (field.fieldvaluetyperecord === null) continue;
    const source: ContextListSource = { listSourceStatus: 'unmapped' };
    if (field.source_label) source.listSourceLabel = field.source_label;
    const direct = new Set(
      records.filter((r) => r.internalid === field.fieldvaluetyperecord).map((r) => r.scriptid),
    );
    const candidates = new Set(
      names.filter((n) => n.name === field.source_label).map((n) => n.skey),
    );
    if (direct.size === 1 && field.fieldvaluetyperecord > 0) {
      source.listSource = [...direct][0];
      source.listSourceStatus = 'resolved';
      source.listSourceBasis = 'custom-record-id';
    } else if (direct.size > 1 || candidates.size > 1) {
      source.listSourceStatus = 'ambiguous';
    } else if (field.fieldvaluetyperecord < 0 && candidates.size === 1) {
      source.listSource = [...candidates][0];
      source.listSourceStatus = 'resolved';
      source.listSourceBasis = 'unique-display-name';
    }
    // Duplicate definition rows are not safe to reconcile silently.
    out[field.scriptid] = out[field.scriptid] ? { listSourceStatus: 'ambiguous' } : source;
  }
  return out;
}
