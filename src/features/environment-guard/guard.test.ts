import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyEnvironmentGuard, BANNER_HOST_ID, defaultBannerLabel } from './guard';

const pill = (doc: Document) =>
  doc.getElementById(BANNER_HOST_ID)?.shadowRoot?.querySelector<HTMLElement>('.pill') ?? null;

describe('Environment Guard', () => {
  beforeEach(() => {
    // Any canvas use would reintroduce the CSP-sensitive favicon generation path.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('renders a banner with the environment color and default label', () => {
    applyEnvironmentGuard(document, {
      enabled: true,
      accountId: '1234567-sb1',
      environment: 'sandbox',
      color: '#d97706',
    });
    const host = document.getElementById(BANNER_HOST_ID);
    expect(host?.getAttribute('data-environment')).toBe('sandbox');
    expect(pill(document)?.textContent).toBe('1234567-SB1 · Sandbox');
    expect(pill(document)?.style.background).toBe('rgb(217, 119, 6)');
  });

  it('uses the custom label as text only and updates in place', () => {
    applyEnvironmentGuard(document, {
      enabled: true,
      accountId: '1',
      environment: 'production',
      color: '#dc2626',
      label: '<img src=x onerror=alert(1)>',
    });
    expect(document.querySelectorAll(`#${BANNER_HOST_ID}`)).toHaveLength(1);
    expect(pill(document)?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(pill(document)?.querySelector('img')).toBeNull();
  });

  it('removes the banner and restores the favicon when disabled', () => {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.href = '/favicon.ico';
    document.head.append(icon);
    applyEnvironmentGuard(document, {
      enabled: false,
      accountId: '1',
      environment: 'production',
      color: '#dc2626',
    });
    expect(document.getElementById(BANNER_HOST_ID)).toBeNull();
    expect(icon.rel).toBe('icon');
  });

  it('preserves the site favicon without creating images or using canvas', () => {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.href = 'https://1234567.app.netsuite.com/favicon.ico';
    document.head.append(icon);
    const create = vi.spyOn(document, 'createElement');
    applyEnvironmentGuard(document, {
      enabled: true,
      accountId: '1234567',
      environment: 'production',
      color: '#dc2626',
    });
    expect(icon.rel).toBe('icon');
    expect(icon.href).toBe('https://1234567.app.netsuite.com/favicon.ico');
    expect(document.querySelector('[data-suitelens-favicon]')).toBeNull();
    expect(create.mock.calls.some(([tag]) => tag === 'img' || tag === 'canvas')).toBe(false);
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it('restores legacy favicon overrides when enabled or disabled', () => {
    for (const enabled of [true, false]) {
      const original = document.createElement('link');
      original.href = '/favicon.ico';
      original.rel = 'suitelens-original-icon';
      original.setAttribute('data-suitelens-disabled-rel', 'shortcut icon');
      original.setAttribute('data-suitelens-original-href', original.href);
      const override = document.createElement('link');
      override.rel = 'icon';
      override.setAttribute('data-suitelens-favicon', '');
      override.href = 'data:image/png;base64,fake';
      document.head.append(original, override);
      applyEnvironmentGuard(document, {
        enabled,
        accountId: '1',
        environment: 'production',
        color: '#dc2626',
      });
      expect(override.isConnected).toBe(false);
      expect(original.rel).toBe('shortcut icon');
      expect(original.hasAttribute('data-suitelens-original-href')).toBe(false);
      expect(original.hasAttribute('data-suitelens-disabled-rel')).toBe(false);
      original.remove();
    }
  });

  it('builds default labels', () => {
    expect(defaultBannerLabel('1234567', 'production')).toBe('1234567 · Production');
  });
});
