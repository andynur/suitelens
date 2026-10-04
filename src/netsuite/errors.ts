import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'NOT_NETSUITE',
  'NOT_A_RECORD',
  'NO_CONTENT_SCRIPT',
  'BRIDGE_UNAVAILABLE',
  'REQUIRE_UNAVAILABLE',
  'MODULE_UNAVAILABLE',
  'TIMEOUT',
  'PERMISSION_DENIED',
  'TABLE_UNAVAILABLE',
  'QUERY_FAILED',
  'XML_UNAVAILABLE',
  'ACCOUNT_MISMATCH',
  'INVALID_RESPONSE',
  'UNSUPPORTED',
  'UNKNOWN',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const LoupeErrorShapeSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  detail: z.string().optional(),
});
export type LoupeErrorShape = z.infer<typeof LoupeErrorShapeSchema>;

export class LoupeError extends Error {
  readonly code: ErrorCode;
  readonly detail?: string;

  constructor(code: ErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'LoupeError';
    this.code = code;
    this.detail = detail;
  }

  toShape(): LoupeErrorShape {
    return this.detail === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, detail: this.detail };
  }

  static fromShape(shape: LoupeErrorShape): LoupeError {
    return new LoupeError(shape.code, shape.message, shape.detail);
  }
}

export function toLoupeError(err: unknown): LoupeError {
  if (err instanceof LoupeError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new LoupeError('UNKNOWN', message);
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
