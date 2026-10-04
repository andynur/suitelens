import type { DomSignals } from '../context/detect';

/**
 * Readers for NetSuite form DOM. They take a `ParentNode` so they work on the live page
 * (content script) and on fixture documents (tests). They only read text; nothing from
 * the page is ever re-inserted as HTML.
 *
 * VERIFY: NetSuite renders body field labels as `<span id="<fieldid>_fs_lbl">` inside a
 * `<span id="<fieldid>_fs_lbl_uir_label" class="uir-label">` wrapper, and marks mandatory
 * fields with an element of class `uir-required-icon`. Confirm on standard and custom forms.
 */
export const FIELD_LABEL_SUFFIX = '_fs_lbl';
export const FIELD_LABEL_SELECTOR = `span[id$="${FIELD_LABEL_SUFFIX}"]`;
const MANDATORY_SELECTOR = '.uir-required-icon';

export type DomFieldLabel = {
  id: string;
  label: string;
  mandatory: boolean;
};

export function fieldIdFromLabelElement(el: Element): string | undefined {
  const id = el.id;
  if (!id.endsWith(FIELD_LABEL_SUFFIX)) return undefined;
  const fieldId = id.slice(0, -FIELD_LABEL_SUFFIX.length);
  return /^[a-z0-9_]+$/i.test(fieldId) ? fieldId.toLowerCase() : undefined;
}

export function readFieldLabels(root: ParentNode): DomFieldLabel[] {
  const out: DomFieldLabel[] = [];
  const seen = new Set<string>();
  for (const el of Array.from(root.querySelectorAll(FIELD_LABEL_SELECTOR))) {
    const id = fieldIdFromLabelElement(el);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const wrapper = el.parentElement;
    const mandatory =
      el.querySelector(MANDATORY_SELECTOR) !== null ||
      (wrapper?.querySelector(MANDATORY_SELECTOR) ?? null) !== null;
    out.push({ id, label: cleanLabel(el), mandatory });
  }
  return out;
}

export function readDomSignals(doc: Document): DomSignals {
  // VERIFY: hidden inputs available on record forms (view and edit mode).
  const baseRecordType = inputValue(doc, 'baserecordtype');
  const recordId = inputValue(doc, 'id');
  return { baseRecordType, recordId };
}

function inputValue(doc: Document, name: string): string | null {
  const el = doc.querySelector(`input[name="${name}"]`);
  return el instanceof HTMLInputElement ? el.value : null;
}

function cleanLabel(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  // Remove injected Loupe badges and required markers from the label text.
  clone.querySelectorAll(`${MANDATORY_SELECTOR}, [data-loupe]`).forEach((n) => n.remove());
  return (clone.textContent ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\*$/, '')
    .trim();
}
