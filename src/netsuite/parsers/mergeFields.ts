import { z } from 'zod';
import type { FieldSource, RecordFieldInfo, SublistInfo } from '../types';
import type { DomFieldLabel } from './formDom';
import type { ParsedRecordXml } from './recordXml';
import { isSensitiveFieldId } from './sensitiveFields';

/** Field metadata read through `N/currentRecord` by the bridge (edit/create mode). */
export const BridgeFieldSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
  mandatory: z.boolean().optional(),
  disabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
  value: z.string().optional(),
  text: z.string().optional(),
});
export type BridgeField = z.infer<typeof BridgeFieldSchema>;

export const CurrentRecordFieldsSchema = z.object({
  recordType: z.string().optional(),
  recordId: z.string().optional(),
  fields: z.array(BridgeFieldSchema),
  sublists: z.array(
    z.object({
      id: z.string(),
      lineCount: z.number().int().nonnegative(),
      fields: z.array(BridgeFieldSchema),
    }),
  ),
});
export type CurrentRecordFields = z.infer<typeof CurrentRecordFieldsSchema>;

/**
 * Custom field prefixes. `custpage` fields are added by scripts at runtime.
 * VERIFY: list is complete for the field types Loupe shows.
 */
const CUSTOM_PREFIX_RE =
  /^(custbody|custcol|custentity|custitem|custevent|custrecord|custitemnumber|custpage)[_\d]/;

export function isCustomFieldId(id: string): boolean {
  return CUSTOM_PREFIX_RE.test(id);
}

export type MergeInput = {
  xml?: ParsedRecordXml;
  domLabels?: DomFieldLabel[];
  currentRecord?: CurrentRecordFields;
};

export type MergeOutput = {
  fields: RecordFieldInfo[];
  sublists: SublistInfo[];
  sources: FieldSource[];
};

/**
 * Combines the three field sources (F-1.10). Fields with a form label come first, in page
 * order. Precedence:
 * label: currentRecord > DOM; type/flags: currentRecord; value: currentRecord text > value > XML.
 */
export function mergeFieldSources(input: MergeInput): MergeOutput {
  const sources: FieldSource[] = [];
  if (input.xml) sources.push('xml');
  if (input.domLabels && input.domLabels.length > 0) sources.push('dom');
  if (input.currentRecord) sources.push('currentRecord');

  const order: string[] = [];
  const byId = new Map<string, RecordFieldInfo>();
  // Defence in depth: the parsers already drop these, the bridge input is checked here.
  const get = (id: string): RecordFieldInfo => {
    let field = byId.get(id);
    if (!field) {
      field = { id, custom: isCustomFieldId(id), sources: [] };
      byId.set(id, field);
      order.push(id);
    }
    return field;
  };

  for (const f of input.xml?.fields ?? []) {
    if (isSensitiveFieldId(f.id)) continue;
    const field = get(f.id);
    field.value = f.value;
    addSource(field, 'xml');
  }
  for (const l of input.domLabels ?? []) {
    if (isSensitiveFieldId(l.id)) continue;
    const field = get(l.id);
    if (l.label) field.label = l.label;
    if (l.mandatory) field.mandatory = true;
    addSource(field, 'dom');
  }
  for (const b of input.currentRecord?.fields ?? []) {
    if (isSensitiveFieldId(b.id)) continue;
    applyBridgeField(get(b.id), b);
  }

  // Fields on the form come first, in the order the page shows them; the rest keep the
  // record data order.
  const domIndex = new Map((input.domLabels ?? []).map((l, i) => [l.id, i]));
  const rank = (id: string) => domIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
  const sorted = order
    .map((id, i) => ({ id, i }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i)
    .map(({ id }) => id);

  return {
    fields: sorted.map((id) => byId.get(id)).filter((f): f is RecordFieldInfo => !!f),
    sublists: mergeSublists(input),
    sources,
  };
}

function mergeSublists(input: MergeInput): SublistInfo[] {
  const out = new Map<string, SublistInfo>();
  for (const s of input.xml?.sublists ?? []) {
    out.set(s.id, {
      id: s.id,
      lineCount: s.lineCount,
      fields: s.fieldIds
        .filter((id) => !isSensitiveFieldId(id))
        .map((id) => ({ id, custom: isCustomFieldId(id), sources: ['xml'] })),
    });
  }
  for (const s of input.currentRecord?.sublists ?? []) {
    const existing = out.get(s.id) ?? { id: s.id, lineCount: s.lineCount, fields: [] };
    existing.lineCount = Math.max(existing.lineCount, s.lineCount);
    for (const b of s.fields) {
      if (isSensitiveFieldId(b.id)) continue;
      let field = existing.fields.find((f) => f.id === b.id);
      if (!field) {
        field = { id: b.id, custom: isCustomFieldId(b.id), sources: [] };
        existing.fields.push(field);
      }
      applyBridgeField(field, b);
    }
    out.set(s.id, existing);
  }
  return Array.from(out.values());
}

function applyBridgeField(field: RecordFieldInfo, b: BridgeField): void {
  if (b.label) field.label = b.label;
  if (b.type) field.type = b.type;
  if (b.mandatory !== undefined) field.mandatory = b.mandatory;
  if (b.disabled !== undefined) field.disabled = b.disabled;
  if (b.hidden !== undefined) field.hidden = b.hidden;
  const value = b.text ?? b.value;
  if (value !== undefined && value !== '') field.value = value;
  addSource(field, 'currentRecord');
}

function addSource(field: RecordFieldInfo, source: FieldSource): void {
  if (!field.sources.includes(source)) field.sources.push(source);
}
