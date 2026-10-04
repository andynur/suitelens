import '../netsuite/zodSetup';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { createBridgeHandler, type PageGlobals } from '../netsuite/bridge/handler';
import { installBridgeListener } from '../netsuite/bridge/transport';

/**
 * MAIN-world bridge (unlisted script, injected by the content script on demand).
 * Reads its per-tab nonce from its own <script> element, removes it, and answers only
 * messages carrying that nonce. Allow-listed operations only (netsuite/bridge/handler.ts).
 */

// document.currentScript is only set while this script is being evaluated.
const scriptEl = document.currentScript;
const nonce = scriptEl?.dataset.loupeNonce;
scriptEl?.removeAttribute('data-loupe-nonce');

export default defineUnlistedScript(() => {
  if (!nonce || !/^[a-f0-9]{32}$/.test(nonce)) return;
  installBridgeListener(
    window,
    nonce,
    createBridgeHandler({ globals: window as unknown as PageGlobals }),
  );
});
