import { readOnlyStatement } from '../../../packages/mcp-bridge/src/readOnly';
import { z } from 'zod';
import { SuiteLensError } from '../errors';

export const CONSOLE_ROW_LIMIT = 5000;
export const DEFAULT_MAX_ROWS = 50_000;
export const MAX_CONSOLE_ROWS = 100_000;
export const CONSOLE_PAGE_SIZE = 1000;
export const CONSOLE_TIMEOUT_MS = 30_000;

export function isReadOnlyQuery(sql: string): boolean {
  return readOnlyStatement(sql) !== undefined;
}

export const ConsoleSqlSchema = z
  .string()
  .min(1)
  .max(100_000)
  .refine(isReadOnlyQuery)
  .transform((sql) => readOnlyStatement(sql)!);
export const ConsoleRequestFields = {
  accountId: z.string().min(1).max(100),
  sql: ConsoleSqlSchema,
  params: z
    .array(z.union([z.string().max(100_000), z.number().finite(), z.boolean()]))
    .max(100)
    .optional(),
  offset: z.number().int().min(0).max(MAX_CONSOLE_ROWS).optional(),
};
export const ConsoleRowsSchema = z
  .array(z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean(), z.null()])))
  .max(MAX_CONSOLE_ROWS);
export const ConsoleResultSchema = z.object({
  accountId: z.string().min(1),
  rows: ConsoleRowsSchema,
  // At the limit we cannot tell whether NetSuite has more rows without paging.
  atLimit: z.boolean(),
});
export type ConsoleResult = z.infer<typeof ConsoleResultSchema>;
export type ConsoleOptions = {
  accountId: string;
  signal?: AbortSignal;
  params?: (string | number | boolean)[];
  maxRows?: number;
  onProgress?: (loaded: number) => void;
};

/** Ignore question marks in literals, identifiers and comments. */
export function placeholderCount(sql: string): number {
  return (
    sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"/g, '').match(/\?/g) ?? []
  ).length;
}

export function validateParameters(sql: string, params: unknown) {
  const values = ConsoleRequestFields.params.parse(params ?? [])!;
  if (placeholderCount(sql) !== values.length)
    throw new SuiteLensError('UNSUPPORTED', 'Provide one value for each ? placeholder.');
  return values;
}

/** Nested ROWNUM avoids the 5,000-row single-call ceiling and retains mapped aliases.
 * VERIFY: supported on each account; use a unique ORDER BY for stable pages.
 */
export function consolePageSql(sql: string, offset: number): string {
  if (/suitelens_page_row/i.test(sql))
    throw new SuiteLensError('UNSUPPORTED', 'The alias suitelens_page_row is reserved for paging.');
  return `SELECT * FROM (SELECT suitelens_page_source.*, ROWNUM AS suitelens_page_row FROM (\n${validateConsoleSql(sql)}\n) suitelens_page_source WHERE ROWNUM <= ${offset + CONSOLE_PAGE_SIZE}) WHERE suitelens_page_row > ${offset}`;
}

export async function collectConsolePages(
  fetchPage: (offset: number, signal: AbortSignal) => Promise<ConsoleResult>,
  options: ConsoleOptions,
): Promise<ConsoleResult> {
  const maxRows = z
    .number()
    .int()
    .min(1)
    .max(MAX_CONSOLE_ROWS)
    .parse(options.maxRows ?? DEFAULT_MAX_ROWS);
  const rows: ConsoleResult['rows'] = [];
  let more = false;
  for (let offset = 0; offset < maxRows; offset += CONSOLE_PAGE_SIZE) {
    throwIfCancelled(options.signal);
    const page = await waitForConsole((signal) => fetchPage(offset, signal), options.signal);
    throwIfCancelled(options.signal);
    if (page.accountId !== options.accountId)
      throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed during execution.');
    const remaining = maxRows - rows.length;
    rows.push(...page.rows.slice(0, remaining));
    options.onProgress?.(rows.length);
    more = page.rows.length === CONSOLE_PAGE_SIZE || page.rows.length > remaining;
    if (!more) break;
  }
  return { accountId: options.accountId, rows, atLimit: more && rows.length === maxRows };
}

export function validateConsoleSql(sql: string): string {
  const parsed = ConsoleSqlSchema.safeParse(sql);
  if (!parsed.success)
    throw new SuiteLensError(
      'UNSUPPORTED',
      'Run one read-only SELECT query (up to 100,000 characters).',
      'Use SELECT or WITH … SELECT. Run multiple statements separately or select one statement first.',
    );
  return parsed.data;
}

export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new SuiteLensError('CANCELLED', 'Query cancelled.');
}

/** Stop waiting promptly; NetSuite has no abort API for an already dispatched query. */
export function waitForConsole<T>(
  run: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new SuiteLensError('CANCELLED', 'Query cancelled.'));
      return;
    }
    const controller = new AbortController();
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      controller.abort();
      cleanup();
      reject(new SuiteLensError('CANCELLED', 'Query cancelled.'));
    };
    const timer = setTimeout(() => {
      cleanup();
      controller.abort();
      reject(new SuiteLensError('TIMEOUT', 'Query timed out.'));
    }, CONSOLE_TIMEOUT_MS);
    signal?.addEventListener('abort', cancel, { once: true });
    void Promise.resolve()
      .then(() => {
        throwIfCancelled(controller.signal);
        return run(controller.signal);
      })
      .then(
        (value) => {
          cleanup();
          resolve(value);
        },
        (error: unknown) => {
          cleanup();
          reject(error);
        },
      );
  });
}

/** Measure async execution outside React's render lifecycle. */
export async function measureConsoleRun<T>(run: () => Promise<T>) {
  const started = performance.now();
  const result = await run();
  return { result, elapsedMs: Math.round(performance.now() - started) };
}
