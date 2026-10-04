/**
 * Minimal logger. Never log record values, query results or secrets at info level or
 * above (docs/security-privacy.md §2.6). Pass only IDs, codes and counts.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = import.meta.env.DEV ? 'debug' : 'warn';

function log(level: Level, scope: string, message: string, meta?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[minLevel]) return;
  const line = `[SuiteLens:${scope}] ${message}`;
  const fn = level === 'debug' ? console.debug : console[level];
  if (meta) fn(line, meta);
  else fn(line);
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => log('debug', scope, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log('info', scope, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', scope, message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', scope, message, meta),
  };
}
