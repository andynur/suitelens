import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { AI_PROVIDER_ORIGINS } from './src/features/ai/catalog';

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
    version_name: '1.0.0-rc.1',
    short_name: 'SuiteLens',
    // Store summary (max 132 chars). The Oracle disclaimer lives in the listing, README and About.
    description:
      'Field IDs, scripts, workflows and SuiteQL beside any NetSuite record. Production-safe. No server, no tracking. Open source.',
    // Permission justifications: docs/decisions/0003-permissions.md
    permissions: ['sidePanel', 'storage', 'scripting', 'activeTab'],
    host_permissions: NETSUITE_MATCHES,
    // AI Assist (BYOK, ADR 0041/0043): only the chosen provider's origin is requested, at
    // runtime, when the user saves that provider's key.
    optional_host_permissions: AI_PROVIDER_ORIGINS,
    optional_permissions: ['nativeMessaging'],
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
