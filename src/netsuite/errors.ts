import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'NOT_NETSUITE',
  'NOT_A_RECORD',
  'NO_CONTENT_SCRIPT',
  'BRIDGE_UNAVAILABLE',
  'REQUIRE_UNAVAILABLE',
  'MODULE_UNAVAILABLE',
  'TIMEOUT',
  'CANCELLED',
  'PERMISSION_DENIED',
  'TABLE_UNAVAILABLE',
  'QUERY_FAILED',
  'XML_UNAVAILABLE',
  'ACCOUNT_MISMATCH',
  'INVALID_RESPONSE',
  'UNSUPPORTED',
  'AI_NOT_CONFIGURED',
  'AI_LOCKED',
  'AI_LIMIT_REACHED',
  'AI_PROVIDER_ERROR',
  'UNKNOWN',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const SuiteLensErrorShapeSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  detail: z.string().optional(),
});
export type SuiteLensErrorShape = z.infer<typeof SuiteLensErrorShapeSchema>;

export class SuiteLensError extends Error {
  readonly code: ErrorCode;
  readonly detail?: string;

  constructor(code: ErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'SuiteLensError';
    this.code = code;
    this.detail = detail;
  }

  toShape(): SuiteLensErrorShape {
    return this.detail === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, detail: this.detail };
  }

  static fromShape(shape: SuiteLensErrorShape): SuiteLensError {
    return new SuiteLensError(shape.code, shape.message, shape.detail);
  }
}

export function toSuiteLensError(err: unknown): SuiteLensError {
  if (err instanceof SuiteLensError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new SuiteLensError('UNKNOWN', message);
}

/**
 * Maps a SuiteQL error message to an error code.
 * VERIFY: exact NetSuite error texts. Patterns are deliberately broad; unknown texts
 * fall back to QUERY_FAILED so the UI still explains likely causes.
 */
export function classifySuiteQLError(message: string): ErrorCode {
  if (
    /permission|not authori[sz]ed|insufficient|access denied|INSUFFICIENT_PERMISSION/i.test(message)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    /unknown identifier|invalid or unsupported search|search\s?type|not\s+found|does not exist|invalid column|invalid table|SEARCH_ERROR/i.test(
      message,
    )
  ) {
    return 'TABLE_UNAVAILABLE';
  }
  return 'QUERY_FAILED';
}

/** Schema diagnostics for the user, without including response values or query text. */
export function invalidResponseError(
  stage: string,
  issues: readonly { code: string; path: readonly PropertyKey[] }[],
): SuiteLensError {
  const summary = issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.map((part) => String(part).slice(0, 80)).join('.') || 'response';
      return `${path}: ${issue.code}`;
    })
    .join('; ');
  return new SuiteLensError('INVALID_RESPONSE', stage, `${stage} ${summary}`);
}
