import { z } from 'zod';
import { readOnlyStatement } from './readOnly.js';

export const NATIVE_HOST = 'com.suitelens.bridge';
export const MAX_FRAME_BYTES = 900_000;
const Id = z.string().uuid();
const RecordType = z.string().regex(/^[a-z][a-z0-9_]{0,99}$/);
const ScriptIdentifier = z
  .string()
  .regex(/^(?:[1-9][0-9]{0,15}|customscript_[a-z0-9_]{1,115})$/)
  .describe('Script internal ID or customscript_ script ID, never a File Cabinet file ID.');
export const ToolInputs = {
  get_page_context: z.strictObject({}),
  get_record_schema: z.strictObject({ recordType: RecordType }),
  get_automations: z.strictObject({ recordType: RecordType }),
  run_suiteql: z.strictObject({
    sql: z
      .string()
      .min(1)
      .max(100_000)
      .refine(
        (sql) => readOnlyStatement(sql) !== undefined,
        'Only one SELECT/WITH read is allowed.',
      ),
    params: z
      .array(z.union([z.string().max(10_000), z.number().finite(), z.boolean()]))
      .max(100)
      .default([]),
    limit: z.number().int().min(1).max(1000).default(100),
  }),
  where_used: z.strictObject({
    id: z.string().regex(/^(?:[a-zA-Z_][a-zA-Z0-9_]{0,127}|[1-9][0-9]{0,19})$/),
  }),
  get_script_source: z.strictObject({ scriptId: ScriptIdentifier }),
  read_context: z.strictObject({ recordType: RecordType }),
} as const;
export const ToolNameSchema = z.enum([
  'get_page_context',
  'get_record_schema',
  'get_automations',
  'run_suiteql',
  'where_used',
  'get_script_source',
  'read_context',
]);
export type ToolName = z.infer<typeof ToolNameSchema>;
export const NativeRequestSchema = z
  .strictObject({
    type: z.literal('request'),
    id: Id,
    sessionId: Id,
    agent: z
      .string()
      .min(1)
      .max(80)
      .refine((name) =>
        [...name].every(
          (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
        ),
      ),
    tool: ToolNameSchema,
    input: z.unknown(),
  })
  .superRefine((value, ctx) => {
    if (!ToolInputs[value.tool].safeParse(value.input).success)
      ctx.addIssue({ code: 'custom', message: 'Invalid tool input' });
  });
export type NativeRequest = z.infer<typeof NativeRequestSchema>;
export const NativeResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ type: z.literal('response'), id: Id, ok: z.literal(true), data: z.unknown() }),
  z.strictObject({
    type: z.literal('response'),
    id: Id,
    ok: z.literal(false),
    error: z.enum([
      'NOT_AUTHORIZED',
      'INVALID_INPUT',
      'RATE_LIMIT',
      'BUSY',
      'TARGET_CHANGED',
      'READ_FAILED',
      'TOO_LARGE',
      'DISCONNECTED',
    ]),
  }),
]);
export type NativeResponse = z.infer<typeof NativeResponseSchema>;
export const McpControlSchema = z.discriminatedUnion('action', [
  z.strictObject({
    type: z.literal('suitelens:mcp'),
    action: z.literal('connect'),
    tabId: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('suitelens:mcp'), action: z.literal('disconnect') }),
  z.strictObject({ type: z.literal('suitelens:mcp'), action: z.literal('approve'), sessionId: Id }),
  z.strictObject({ type: z.literal('suitelens:mcp'), action: z.literal('deny'), sessionId: Id }),
  z.strictObject({ type: z.literal('suitelens:mcp'), action: z.literal('clearLog') }),
]);
export const McpStateSchema = z.object({
  connected: z.boolean(),
  accountId: z.string().max(100).optional(),
  environment: z.string().optional(),
  sessions: z
    .array(
      z.object({
        id: Id,
        agent: z.string().max(80),
        status: z.enum(['pending', 'approved', 'denied']),
        expiresAt: z.number(),
      }),
    )
    .max(20),
  log: z
    .array(
      z.object({
        tool: ToolNameSchema,
        time: z.number(),
        accountId: z.string().max(100),
        rows: z.number().int().nonnegative(),
        outcome: z.enum(['ok', 'denied', 'error']),
      }),
    )
    .max(200),
  error: z.enum(['CONNECT_FAILED', 'NOT_NETSUITE', 'DISCONNECTED']).optional(),
});
export type McpState = z.infer<typeof McpStateSchema>;

export const McpControlResponseSchema = z.boolean();
