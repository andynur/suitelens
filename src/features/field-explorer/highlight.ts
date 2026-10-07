import { fieldIdFromLabelElement, FIELD_LABEL_SELECTOR } from '../../netsuite/parsers/formDom';

/**
 * "Show on page" (content script side). Scrolls a body field into view and outlines it for a
 * moment. Visual only: it changes inline outline styles and restores them; it never touches
 * field values.
 *
 * VERIFY: Redwood forms wrap label and value in `.uir-field-wrapper`; classic forms use a
 * table row. Fall back to the label's parent.
 */
const ATTR = 'data-suitelens-highlight';
const OUTLINE = '2px solid #1868DB'; // ADS color.border.focused (light)
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function highlightFieldOnPage(doc: Document, fieldId: string, durationMs = 2000): boolean {
  const label = Array.from(doc.querySelectorAll(FIELD_LABEL_SELECTOR)).find(
    (el) => fieldIdFromLabelElement(el) === fieldId,
  );
  if (!label) return false;
  const target = label.closest('.uir-field-wrapper, tr') ?? label.parentElement ?? label;
  if (!(target instanceof HTMLElement)) return false;
  // `checkVisibility` is missing in older engines and in jsdom; treat that as visible.
  if (typeof target.checkVisibility === 'function' && !target.checkVisibility()) return false;

  target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });

  const previous = timers.get(target);
  if (previous) {
    clearTimeout(previous);
  } else {
    target.dataset.suitelensOutline = target.style.outline;
    target.dataset.suitelensOutlineOffset = target.style.outlineOffset;
  }
  target.setAttribute(ATTR, '');
  target.style.outline = OUTLINE;
  target.style.outlineOffset = '2px';
  timers.set(
    target,
    setTimeout(() => {
      target.style.outline = target.dataset.suitelensOutline ?? '';
      target.style.outlineOffset = target.dataset.suitelensOutlineOffset ?? '';
      delete target.dataset.suitelensOutline;
      delete target.dataset.suitelensOutlineOffset;
      target.removeAttribute(ATTR);
      timers.delete(target);
    }, durationMs),
  );
  return true;
}
