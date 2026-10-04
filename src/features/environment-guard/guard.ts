import { t } from '../../shared/i18n';
import type { Environment } from '../../netsuite/types';

/**
 * Environment Guard (F-1.18 – F-1.20): thin colored banner + favicon tint.
 * Content-script side. Uses a shadow root so NetSuite styles cannot affect it, and only
 * `textContent` for text.
 */

export const BANNER_HOST_ID = 'netsuite-loupe-env-banner';
const FAVICON_MARK = 'data-loupe-favicon';
const ORIGINAL_HREF = 'data-loupe-original-href';

export type GuardState = {
  enabled: boolean;
  accountId: string;
  environment: Environment;
  color: string;
  label?: string;
};

export function defaultBannerLabel(accountId: string, environment: Environment): string {
  return `${accountId.toUpperCase()} · ${t(`env.${environment}`)}`;
}

export function applyEnvironmentGuard(doc: Document, state: GuardState): void {
  if (!state.enabled) {
    removeBanner(doc);
    restoreFavicon(doc);
    return;
  }
  renderBanner(doc, state);
  void tintFavicon(doc, state.color);
}

function renderBanner(doc: Document, state: GuardState): void {
  let host = doc.getElementById(BANNER_HOST_ID);
  if (!host) {
    host = doc.createElement('div');
    host.id = BANNER_HOST_ID;
    host.setAttribute('data-loupe', 'banner');
    host.setAttribute('role', 'status');
    // The host does not take layout space or block clicks.
    host.style.cssText =
      'position:fixed;top:0;left:0;right:0;height:0;z-index:2147483647;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = `
      .bar{position:fixed;top:0;left:0;right:0;height:4px;}
      .pill{position:fixed;top:0;left:50%;transform:translateX(-50%);padding:1px 10px 2px;
        border-radius:0 0 6px 6px;font:600 11px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;
        color:#fff;letter-spacing:.02em;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25);
        text-shadow:0 1px 1px rgba(0,0,0,.35)}`;
    const bar = doc.createElement('div');
    bar.className = 'bar';
    const pill = doc.createElement('div');
    pill.className = 'pill';
    shadow.append(style, bar, pill);
    (doc.body ?? doc.documentElement).append(host);
  }
  const shadow = host.shadowRoot;
  const bar = shadow?.querySelector<HTMLElement>('.bar');
  const pill = shadow?.querySelector<HTMLElement>('.pill');
  if (bar) bar.style.background = state.color;
  if (pill) {
    pill.style.background = state.color;
    pill.textContent =
      state.label?.trim() || defaultBannerLabel(state.accountId, state.environment);
  }
  host.setAttribute('data-environment', state.environment);
  host.setAttribute('aria-label', pill?.textContent ?? '');
}

function removeBanner(doc: Document): void {
  doc.getElementById(BANNER_HOST_ID)?.remove();
}

/** Draws the original favicon with a colored frame; falls back to a solid square. */
async function tintFavicon(doc: Document, color: string): Promise<void> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
  const original =
    links.find((l) => l.hasAttribute(ORIGINAL_HREF))?.getAttribute(ORIGINAL_HREF) ??
    links[0]?.href ??
    new URL('/favicon.ico', doc.location?.href ?? 'https://invalid.local').href;

  const dataUrl = await renderTintedIcon(doc, original, color);
  if (!dataUrl) return;

  let link = doc.querySelector<HTMLLinkElement>(`link[${FAVICON_MARK}]`);
  for (const l of links) {
    if (l === link) continue;
    if (!l.hasAttribute(ORIGINAL_HREF)) l.setAttribute(ORIGINAL_HREF, l.href);
    l.setAttribute('data-loupe-disabled-rel', l.rel);
    l.rel = 'loupe-original-icon';
  }
  if (!link) {
    link = doc.createElement('link');
    link.setAttribute(FAVICON_MARK, '');
    link.setAttribute(ORIGINAL_HREF, original);
    link.rel = 'icon';
    doc.head?.append(link);
  }
  link.href = dataUrl;
}

function restoreFavicon(doc: Document): void {
  doc.querySelector(`link[${FAVICON_MARK}]`)?.remove();
  for (const l of Array.from(
    doc.querySelectorAll<HTMLLinkElement>('link[data-loupe-disabled-rel]'),
  )) {
    l.rel = l.getAttribute('data-loupe-disabled-rel') ?? 'icon';
    l.removeAttribute('data-loupe-disabled-rel');
  }
}

async function renderTintedIcon(
  doc: Document,
  src: string,
  color: string,
): Promise<string | undefined> {
  const canvas = doc.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return undefined;
  const drawFrame = () => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 32, 32);
  };
  try {
    const img = await loadImage(doc, src);
    drawFrame();
    ctx.clearRect(4, 4, 24, 24);
    ctx.drawImage(img, 4, 4, 24, 24);
    return canvas.toDataURL('image/png');
  } catch {
    drawFrame();
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return undefined;
    }
  }
}

function loadImage(doc: Document, src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = doc.createElement('img');
    const timer = setTimeout(() => reject(new Error('timeout')), 3000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('favicon load failed'));
    };
    img.src = src;
  });
}
