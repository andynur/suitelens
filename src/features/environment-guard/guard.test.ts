import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyEnvironmentGuard, BANNER_HOST_ID, defaultBannerLabel } from './guard';

const pill = (doc: Document) =>
  doc.getElementById(BANNER_HOST_ID)?.shadowRoot?.querySelector<HTMLElement>('.pill') ?? null;

describe('Environment Guard', () => {
  beforeEach(() => {
    // jsdom has no canvas; the guard must cope with that (favicon tint is skipped).
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

  it('builds default labels', () => {
    expect(defaultBannerLabel('1234567', 'production')).toBe('1234567 · Production');
  });
});
