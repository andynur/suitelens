import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// `pnpm build:e2e` / `pnpm dev:fixtures`: side panel defaults to FixtureAdapter.
const FIXTURE_BUILD = process.env.VITE_SUITELENS_ADAPTER === 'fixture';

// Only NetSuite UI hosts. Never `<all_urls>` (see docs/security-privacy.md).
// VERIFY: other NetSuite UI domains (e.g. regional data centers) if users report them.
const NETSUITE_MATCHES = ['https://*.app.netsuite.com/*'];

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  imports: false,
  vite: (env) => ({
    plugins: [tailwindcss()],
    define: {
      // Fixture data is bundled only in dev and fixture (E2E) builds; production builds
      // tree-shake FixtureAdapter and every fixture file away.
      __SUITELENS_FIXTURES__: JSON.stringify(env.mode !== 'production' || FIXTURE_BUILD),
      __SUITELENS_DEFAULT_ADAPTER__: JSON.stringify(FIXTURE_BUILD ? 'fixture' : 'live'),
    },
    build: {
      // Minified but never obfuscated (Chrome Web Store policy).
      minify: true,
      sourcemap: false,
    },
  }),
  manifest: {
    name: 'SuiteLens for NetSuite',
    short_name: 'SuiteLens',
    description: 'Developer and admin productivity tools for NetSuite. Not affiliated with Oracle.',
    // Permission justifications: docs/decisions/0003-permissions.md
    permissions: ['sidePanel', 'storage', 'scripting', 'activeTab'],
    host_permissions: NETSUITE_MATCHES,
    web_accessible_resources: [{ resources: ['bridge.js'], matches: NETSUITE_MATCHES }],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
    action: { default_title: 'Open SuiteLens for NetSuite' },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+L' },
        description: 'Open the SuiteLens side panel',
      },
      'open-goto': {
        suggested_key: { default: 'Alt+Shift+G' },
        description: 'Open Quick Go-to',
      },
    },
  },
});
