#!/usr/bin/env node
import { install } from './install.js';
import { nativeHost } from './native.js';
import { serve } from './server.js';
const command = process.argv[2];
try {
  if (command === 'install' || command === 'uninstall')
    await install(process.argv[3] ?? '', command === 'uninstall');
  else if (command === 'native') await nativeHost();
  else if (command === undefined || command === 'serve') await serve();
  else
    throw new Error(
      'Usage: netsuite-suitelens-mcp [serve | install <extension-id> | uninstall <extension-id>]',
    );
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : 'Bridge failed'}\n`);
  process.exitCode = 1;
}
