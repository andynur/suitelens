export type CopyFormat = 'id' | 'quoted' | 'snippet';

export const COPY_FORMATS: readonly CopyFormat[] = ['id', 'quoted', 'snippet'];

/** Text copied for a field ID in the chosen format (F-1.9). */
export function formatFieldCopy(fieldId: string, format: CopyFormat, sublistId?: string): string {
  switch (format) {
    case 'id':
      return fieldId;
    case 'quoted':
      return `'${fieldId}'`;
    case 'snippet':
      return sublistId
        ? `rec.getSublistValue({ sublistId: '${sublistId}', fieldId: '${fieldId}', line: 0 })`
        : `rec.getValue({ fieldId: '${fieldId}' })`;
  }
}
