import type { RecordFieldInfo } from '../../netsuite/types';

export type FieldFilters = {
  query: string;
  customOnly: boolean;
  mandatoryOnly: boolean;
  nonEmptyOnly: boolean;
};

export const EMPTY_FILTERS: FieldFilters = {
  query: '',
  customOnly: false,
  mandatoryOnly: false,
  nonEmptyOnly: false,
};

/** Search by label or field ID (case-insensitive) plus the F-1.8 filters. */
export function filterFields(
  fields: readonly RecordFieldInfo[],
  filters: FieldFilters,
): RecordFieldInfo[] {
  const q = filters.query.trim().toLowerCase();
  return fields.filter((f) => {
    if (filters.customOnly && !f.custom) return false;
    if (filters.mandatoryOnly && !f.mandatory) return false;
    if (filters.nonEmptyOnly && (f.value === undefined || f.value === '')) return false;
    if (!q) return true;
    return f.id.includes(q) || (f.label?.toLowerCase().includes(q) ?? false);
  });
}
