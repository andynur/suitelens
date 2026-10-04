import type { RecordFieldInfo } from '../../netsuite/types';

export type FieldGroups = { onForm: RecordFieldInfo[]; notOnForm: RecordFieldInfo[] };

/**
 * Splits body fields into those with a label on the page and the rest (hidden and system
 * fields from the record data). Without page labels (`hasPageLabels` is about the whole
 * record, not the filtered list) there is nothing to split by.
 */
export function partitionByForm(
  fields: readonly RecordFieldInfo[],
  hasPageLabels: boolean,
): FieldGroups {
  if (!hasPageLabels) {
    return { onForm: [...fields], notOnForm: [] };
  }
  const onForm: RecordFieldInfo[] = [];
  const notOnForm: RecordFieldInfo[] = [];
  for (const f of fields) (f.sources.includes('dom') ? onForm : notOnForm).push(f);
  return { onForm, notOnForm };
}

const BR_RE = /<br\s*\/?>/gi;

/**
 * Text to show for a field value. Address values contain literal `<br>` tags; they become
 * line breaks. The result is still rendered as text, never as HTML.
 */
export function displayValue(value: string | undefined): string {
  return (value ?? '').replace(BR_RE, '\n');
}
