import type { RecordPayloadNode } from '../../netsuite/parsers/recordPayload';

export const MASKED_VALUE = '[MASKED]';

/** Heuristic business-field matching; credential removal happens before this module. */
function isBusinessField(name: string): boolean {
  return /email|phone|mobile|fax|address|addr[123]|zip|postcode|postal|taxid|taxreg|vatreg|ssn|socialsecurity|birth|dob|creditcard|cardnumber|bank|iban|routing|salary|compensation/i.test(
    name.replace(/[^a-z0-9]/gi, ''),
  );
}

/** Clone the ordered tree, masking descendants as well as field-level attributes. */
export function maskPayload(node: RecordPayloadNode, inherited = false): RecordPayloadNode {
  const sensitive =
    inherited ||
    isBusinessField(node.name) ||
    ['name', 'id'].some((key) => isBusinessField(node.attributes[key] ?? ''));
  return {
    name: node.name,
    attributes: Object.fromEntries(
      Object.entries(node.attributes).map(([key, value]) => [
        key,
        (sensitive && !(!inherited && ['name', 'id'].includes(key))) || isBusinessField(key)
          ? MASKED_VALUE
          : value,
      ]),
    ),
    content: node.content.map((part) =>
      typeof part === 'string'
        ? sensitive && part.trim()
          ? MASKED_VALUE
          : part
        : maskPayload(part, sensitive),
    ),
  };
}

const escapeXml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function serializePayloadXml(node: RecordPayloadNode): string {
  const attributes = Object.entries(node.attributes)
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join('');
  return `<${node.name}${attributes}>${node.content
    .map((part) => (typeof part === 'string' ? escapeXml(part) : serializePayloadXml(part)))
    .join('')}</${node.name}>`;
}

export function payloadFilename(
  accountId: string,
  recordType: string,
  id: string,
  format: 'xml' | 'json',
  masked: boolean,
): string {
  const safe = (part: string) => part.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
  return `suitelens-${safe(accountId)}-${safe(recordType)}-${safe(id)}${masked ? '-masked' : ''}.${format}`;
}
