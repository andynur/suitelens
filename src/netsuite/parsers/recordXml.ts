import { LoupeError } from '../errors';

/**
 * Parser for the record XML NetSuite returns when `xml=T` is added to a record URL.
 *
 * VERIFY: assumed shape (confirm in a sandbox, see fixtures/records/*.xml):
 *   <nsResponse>
 *     <record recordType="salesorder" id="1001" ...>
 *       <memo>text</memo>                       ← body field
 *       <machine name="item" ...>               ← sublist
 *         <line><item>12</item>...</line>
 *       </machine>
 *     </record>
 *   </nsResponse>
 * The parser is defensive: it only relies on a `record` element, `machine` children and
 * `line` grandchildren. Values are kept as text only.
 */

export type ParsedXmlField = { id: string; value: string };
export type ParsedXmlSublist = { id: string; lineCount: number; fieldIds: string[] };
export type ParsedRecordXml = {
  recordType?: string;
  id?: string;
  fields: ParsedXmlField[];
  sublists: ParsedXmlSublist[];
};

export type XmlParse = (xml: string) => Document;

const MAX_VALUE_LENGTH = 2000;
const FIELD_ID_RE = /^[a-z0-9_]+$/i;

const defaultParse: XmlParse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');

export function parseRecordXml(xml: string, parse: XmlParse = defaultParse): ParsedRecordXml {
  const trimmed = xml.trimStart();
  if (
    !trimmed.startsWith('<?xml') &&
    !trimmed.startsWith('<nsResponse') &&
    !trimmed.startsWith('<record')
  ) {
    // Usually an HTML login/error page instead of XML.
    throw new LoupeError(
      'XML_UNAVAILABLE',
      'NetSuite did not return record XML. You may be logged out or lack access to this record.',
    );
  }
  const doc = parse(trimmed);
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new LoupeError('XML_UNAVAILABLE', 'The record XML could not be parsed.');
  }
  const record = doc.getElementsByTagName('record')[0];
  if (!record) {
    throw new LoupeError('XML_UNAVAILABLE', 'The XML response contains no record element.');
  }

  const result: ParsedRecordXml = { fields: [], sublists: [] };
  const recordType = record.getAttribute('recordType') ?? record.getAttribute('recordtype');
  if (recordType) result.recordType = recordType.toLowerCase();
  const id = record.getAttribute('id');
  if (id) result.id = id;

  const seen = new Set<string>();
  for (const child of Array.from(record.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'machine') {
      const sublist = parseMachine(child);
      if (sublist) result.sublists.push(sublist);
      continue;
    }
    if (!FIELD_ID_RE.test(tag) || seen.has(tag)) continue;
    seen.add(tag);
    result.fields.push({ id: tag, value: truncate(child.textContent ?? '') });
  }
  return result;
}

function parseMachine(machine: Element): ParsedXmlSublist | undefined {
  const name = machine.getAttribute('name')?.toLowerCase();
  if (!name || !FIELD_ID_RE.test(name)) return undefined;
  const lines = Array.from(machine.children).filter((c) => c.tagName.toLowerCase() === 'line');
  const fieldIds: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    const lower = id.toLowerCase();
    if (FIELD_ID_RE.test(lower) && !seen.has(lower)) {
      seen.add(lower);
      fieldIds.push(lower);
    }
  };
  // VERIFY: `fields` attribute listing the sublist columns may be present.
  machine
    .getAttribute('fields')
    ?.split(',')
    .forEach((f) => add(f.trim()));
  for (const line of lines) {
    for (const cell of Array.from(line.children)) add(cell.tagName);
  }
  return { id: name, lineCount: lines.length, fieldIds };
}

function truncate(value: string): string {
  return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
}

/**
 * Builds the `xml=T` URL for a record page. Keeps only the parameters that identify the
 * record. VERIFY: whether `xml=T` works on every record type and in edit mode.
 */
export function buildRecordXmlUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  const keep = ['id', 'rectype'];
  const next = new URL(url.origin + url.pathname);
  for (const key of keep) {
    const value = url.searchParams.get(key);
    if (value) next.searchParams.set(key, value);
  }
  next.searchParams.set('xml', 'T');
  return next.toString();
}
