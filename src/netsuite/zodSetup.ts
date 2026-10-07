import { z } from 'zod';

/**
 * Disables Zod's JIT, which compiles validators with `new Function` when the page CSP
 * allows it. The extension never evaluates generated code (docs/security-privacy.md §2.1).
 * Import this module first in every entrypoint.
 */
z.config({ jitless: true });
