import { t } from '../../shared/i18n';
import type { Environment } from '../../netsuite/types';
import { readableTextOn } from '../../shared/ui/color';

/**
 * Environment Guard: thin colored banner; preserve the site favicon under restrictive CSP.
 * Content-script side. Uses a shadow root so NetSuite styles cannot affect it, and only
 * `textContent` for text.
 */

export const BANNER_HOST_ID = 'netsuite-suitelens-env-banner';
const FAVICON_MARK = 'data-suitelens-favicon';

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
  // Clean up favicon overrides left by older content scripts. Never inject data: images.
  restoreFavicon(doc);
  if (!state.enabled) {
    removeBanner(doc);
    return;
  }
  renderBanner(doc, state);
}

function renderBanner(doc: Document, state: GuardState): void {
  let host = doc.getElementById(BANNER_HOST_ID);
  if (!host) {
    host = doc.createElement('div');
    host.id = BANNER_HOST_ID;
    host.setAttribute('data-suitelens', 'banner');
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
        letter-spacing:.02em;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25)}`;
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
    // Light colors (sandbox amber) get dark text, dark ones white.
    pill.style.color = readableTextOn(state.color);
    pill.textContent =
      state.label?.trim() || defaultBannerLabel(state.accountId, state.environment);
  }
  host.setAttribute('data-environment', state.environment);
  host.setAttribute('aria-label', pill?.textContent ?? '');
}

function removeBanner(doc: Document): void {
  doc.getElementById(BANNER_HOST_ID)?.remove();
}

function restoreFavicon(doc: Document): void {
  doc.querySelector(`link[${FAVICON_MARK}]`)?.remove();
  for (const l of Array.from(
    doc.querySelectorAll<HTMLLinkElement>('link[data-suitelens-disabled-rel]'),
  )) {
    l.rel = l.getAttribute('data-suitelens-disabled-rel') ?? 'icon';
    l.removeAttribute('data-suitelens-disabled-rel');
    l.removeAttribute('data-suitelens-original-href');
  }
}
