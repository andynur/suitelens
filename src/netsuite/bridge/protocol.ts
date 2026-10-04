import { z } from 'zod';
import { SuiteLensErrorShapeSchema } from '../errors';
import { CurrentRecordFieldsSchema } from '../parsers/mergeFields';
import { AUTOMATION_QUERY_IDS } from '../queries/automation';
import { PageContextSchema, RecordFieldsResultSchema, RecordRefSchema } from '../types';

/**
 * Every message that crosses a context boundary (CLAUDE.md). Each receiver parses with
 * these schemas and drops anything that does not match.
 *
 *   side panel ──runtime──► background ──tabs──► content (ISOLATED) ──postMessage──► bridge (MAIN)
 */

export const resultSchema = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: SuiteLensErrorShapeSchema }),
  ]);

export type Result<T> =
  { ok: true; data: T } | { ok: false; error: z.infer<typeof SuiteLensErrorShapeSchema> };

// ---------------------------------------------------------------------------
// Content script operations (requested by the side panel through the background).
// ---------------------------------------------------------------------------

export const QueryIdSchema = z.enum(AUTOMATION_QUERY_IDS);
const VariantIdSchema = z.string().regex(/^[a-z]{1,20}$/);

export const ContentRequestSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('getPageContext') }),
  z.object({ op: z.literal('getRecordFields'), ref: RecordRefSchema }),
  z.object({ op: z.literal('runQuery'), queryId: QueryIdSchema, variantId: VariantIdSchema }),
]);
export type ContentRequest = z.infer<typeof ContentRequestSchema>;

export const RowsSchema = z.array(z.record(z.string(), z.unknown())).max(5000);

export const ContentResponseSchemas = {
  getPageContext: resultSchema(PageContextSchema),
  getRecordFields: resultSchema(RecordFieldsResultSchema),
  runQuery: resultSchema(RowsSchema),
} as const;

// ---------------------------------------------------------------------------
// Runtime messages (side panel ↔ background ↔ content).
// ---------------------------------------------------------------------------

export const ForwardMessageSchema = z.object({
  type: z.literal('suitelens:forward'),
  tabId: z.number().int().nonnegative(),
  request: ContentRequestSchema,
});
export type ForwardMessage = z.infer<typeof ForwardMessageSchema>;

/** Background → content script. */
export const ContentMessageSchema = z.object({
  type: z.literal('suitelens:content'),
  request: ContentRequestSchema,
});
export type ContentMessage = z.infer<typeof ContentMessageSchema>;

/** Content script → side panel (broadcast) when the page context changes. */
export const ContextChangedMessageSchema = z.object({
  type: z.literal('suitelens:context-changed'),
  context: PageContextSchema,
});
export type ContextChangedMessage = z.infer<typeof ContextChangedMessageSchema>;

// ---------------------------------------------------------------------------
// Bridge (MAIN world) protocol over window.postMessage. Fixed operation allow-list.
// ---------------------------------------------------------------------------

export const BRIDGE_REQUEST_SOURCE = 'netsuite-suitelens:content';
export const BRIDGE_RESPONSE_SOURCE = 'netsuite-suitelens:bridge';

const NonceSchema = z.string().regex(/^[a-f0-9]{32}$/);
const FieldIdSchema = z.string().regex(/^[a-z0-9_]{1,100}$/);
const FieldIdListSchema = z.array(FieldIdSchema).max(1000);
const SublistRequestSchema = z
  .array(z.object({ id: FieldIdSchema, fieldIds: z.array(FieldIdSchema).max(300) }))
  .max(50);

export const BridgeOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('ping') }),
  z.object({ op: z.literal('getRecordType') }),
  z.object({
    op: z.literal('getCurrentRecordFields'),
    fieldIds: FieldIdListSchema,
    sublists: SublistRequestSchema,
  }),
  // Read-only `N/record.load` for view mode, where N/currentRecord reports rendered types.
  z.object({
    op: z.literal('getLoadedRecordFields'),
    recordType: FieldIdSchema,
    recordId: z.string().regex(/^\d{1,20}$/),
    fieldIds: FieldIdListSchema,
    sublists: SublistRequestSchema,
  }),
  z.object({ op: z.literal('runSuiteQL'), queryId: QueryIdSchema, variantId: VariantIdSchema }),
]);
export type BridgeOp = z.infer<typeof BridgeOpSchema>;

export const BridgeRequestSchema = z.object({
  source: z.literal(BRIDGE_REQUEST_SOURCE),
  nonce: NonceSchema,
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  payload: BridgeOpSchema,
});
export type BridgeRequest = z.infer<typeof BridgeRequestSchema>;

export const BridgeResponseSchema = z.object({
  source: z.literal(BRIDGE_RESPONSE_SOURCE),
  nonce: NonceSchema,
  id: z.string(),
  result: z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data: z.unknown() }),
    z.object({ ok: z.literal(false), error: SuiteLensErrorShapeSchema }),
  ]),
});
export type BridgeResponse = z.infer<typeof BridgeResponseSchema>;

export const BridgeDataSchemas = {
  ping: z.object({ requireAvailable: z.boolean() }),
  getRecordType: z.object({
    recordType: z.string().nullable(),
    recordId: z.string().nullable(),
  }),
  getCurrentRecordFields: CurrentRecordFieldsSchema,
  getLoadedRecordFields: CurrentRecordFieldsSchema,
  runSuiteQL: RowsSchema,
} as const;
