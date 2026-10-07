import { SuiteLensError } from '../errors';
import type { RecordRef } from '../types';
import { isSensitiveFieldId } from './sensitiveFields';
import type { XmlParse } from './recordXml';

export const MAX_RECORD_XML_LENGTH = 5 * 1024 * 1024;
const MAX_NODES = 20_000;
const MAX_DEPTH = 40;

/** Ordered XML content preserves repeated fields, sublist lines, attributes and text values. */
export type RecordPayloadNode = {
  name: string;
  attributes: Record<string, string>;
  content: (string | RecordPayloadNode)[];
};

/** Credential-like elements/attributes and comments never cross the content boundary. */
export function readRecordPayload(
  xml: string,
  ref?: RecordRef,
  parse: XmlParse = (text) => new DOMParser().parseFromString(text, 'text/xml'),
  requireIdentity = false,
): { xml: string; json: RecordPayloadNode } {
  const fail = (message: string): never => {
    throw new SuiteLensError('XML_UNAVAILABLE', message);
  };
  if (xml.length > MAX_RECORD_XML_LENGTH) fail('Record XML is too large.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail('Record XML contains an unsupported declaration.');
  const doc = parse(xml);
  if (doc.getElementsByTagName('parsererror').length || !doc.documentElement)
    fail('The record XML could not be parsed.');
  if (!['nsResponse', 'record'].includes(doc.documentElement.tagName))
    fail('NetSuite did not return record XML. You may be logged out or lack access.');
  const records = doc.getElementsByTagName('record');
  if (records.length !== 1) fail('NetSuite did not return a single record XML payload.');
  const record = records[0]!;
  const type = record.getAttribute('recordType') ?? record.getAttribute('recordtype');
  const id = record.getAttribute('id');
  if (requireIdentity && (!id || !type))
    fail('NetSuite returned XML without a verifiable record identity.');
  if ((ref?.id && id && id !== ref.id) || (ref && type && type.toLowerCase() !== ref.recordType))
    fail('NetSuite returned XML for a different record. Refresh the page and retry.');

  let nodes = 0;
  const normalize = (element: Element, depth: number): RecordPayloadNode => {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) fail('Record XML is too complex to inspect.');
    for (const attr of Array.from(element.attributes)) {
      if (isSensitiveFieldId(attr.name)) element.removeAttribute(attr.name);
    }
    const content: RecordPayloadNode['content'] = [];
    for (const child of Array.from(element.childNodes)) {
      if (++nodes > MAX_NODES) fail('Record XML is too complex to inspect.');
      if (child.nodeType === 1) {
        const nested = child as Element;
        if (
          isSensitiveFieldId(nested.tagName) ||
          ['name', 'id'].some((key) => {
            const value = nested.getAttribute(key);
            return value !== null && isSensitiveFieldId(value);
          })
        ) {
          element.removeChild(child);
        } else content.push(normalize(nested, depth + 1));
      } else if (child.nodeType === 3 || child.nodeType === 4) {
        const value = child.textContent ?? '';
        // Ignore indentation between elements, while preserving leaf and mixed text verbatim.
        if (value.trim() || element.children.length === 0) content.push(value);
      } else element.removeChild(child);
    }
    return {
      name: element.tagName,
      attributes: Object.fromEntries(Array.from(element.attributes, (a) => [a.name, a.value])),
      content,
    };
  };
  const json = normalize(doc.documentElement, 0);
  // Serialize only the root: processing instructions outside it are not record data.
  return { xml: new XMLSerializer().serializeToString(doc.documentElement), json };
}
