import './src/netsuite/zodSetup';
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// jsdom omits SubtleCrypto; use the browser-compatible implementation for index hashes.
Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle, configurable: true });

beforeEach(() => {
  fakeBrowser.reset();
  // Layout observers are provided by Chromium; jsdom has no layout engine.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
