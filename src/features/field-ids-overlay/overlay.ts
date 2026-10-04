import { fieldIdFromLabelElement, FIELD_LABEL_SELECTOR } from '../../netsuite/parsers/formDom';

/**
 * "Show field IDs on page" (F-1.11). Adds a small inline badge with the field ID next to each
 * form label. Off by default. Badges are plain text nodes; nothing from the page is
 * re-inserted as HTML.
 */

const BADGE_ATTR = 'data-loupe';
const BADGE_VALUE = 'field-id';
const STYLE_ID = 'netsuite-loupe-field-id-style';

const CSS = `
[${BADGE_ATTR}="${BADGE_VALUE}"]{display:inline-block;margin-left:4px;padding:0 3px;border-radius:3px;
  font:500 9px/12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;vertical-align:baseline;
  color:#1e3a8a;background:#dbeafe;border:1px solid #93c5fd;cursor:copy;white-space:nowrap}
[${BADGE_ATTR}="${BADGE_VALUE}"]:hover{background:#bfdbfe}`;

export function showFieldIdBadges(doc: Document): number {
  ensureStyle(doc);
  let added = 0;
  for (const label of Array.from(doc.querySelectorAll(FIELD_LABEL_SELECTOR))) {
    if (label.querySelector(`[${BADGE_ATTR}="${BADGE_VALUE}"]`)) continue;
    const fieldId = fieldIdFromLabelElement(label);
    if (!fieldId) continue;
    const badge = doc.createElement('span');
    badge.setAttribute(BADGE_ATTR, BADGE_VALUE);
    badge.textContent = fieldId;
    badge.title = fieldId;
    badge.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void navigator.clipboard?.writeText(fieldId).catch(() => undefined);
    });
    label.append(badge);
    added++;
  }
  return added;
}

export function hideFieldIdBadges(doc: Document): void {
  doc.querySelectorAll(`[${BADGE_ATTR}="${BADGE_VALUE}"]`).forEach((n) => n.remove());
  doc.getElementById(STYLE_ID)?.remove();
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (doc.head ?? doc.documentElement).append(style);
}

/** Re-applies badges when NetSuite re-renders parts of the form. Returns a stop function. */
export function watchFieldIdBadges(doc: Document): () => void {
  showFieldIdBadges(doc);
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      showFieldIdBadges(doc);
    }, 250);
  });
  observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    hideFieldIdBadges(doc);
  };
}
