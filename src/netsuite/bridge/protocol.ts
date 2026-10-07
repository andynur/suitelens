import { PdfEditorRequestSchema, PdfEditorSourceSchema } from '../impact/pdfEditor';
import { SearchDiscoveryRequestSchema, SearchDiscoverySchema } from '../impact/searchDiscovery';
import { ImpactSourceRequestSchema, ImpactSourceSchema } from '../impact/source';
import {
  ImpactSavedSearchRequestSchema,
  ImpactSavedSearchSchema,
  SavedSearchDefinitionSchema,
  SavedSearchIdSchema,
} from '../impact/savedSearch';
import { RestletRequestSchema, RestletResponseSchema } from '../restlets/request';
import { ConsoleRequestFields, ConsoleRowsSchema, ConsoleResultSchema } from '../queries/console';
import { z } from 'zod';
import { AiRequestSchema, AiUsageSchema } from '../../features/ai/types';
import { MAX_RECORD_XML_LENGTH } from '../parsers/recordPayload';
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
const FieldIdSchema = z.string().regex(/^[a-z0-9_]{1,100}$/);

export const ContentRequestSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('discoverImpactSavedSearches'), request: SearchDiscoveryRequestSchema }),
  z.object({ op: z.literal('readImpactPdfEditor'), request: PdfEditorRequestSchema }),
  z.object({ op: z.literal('readImpactSavedSearch'), request: ImpactSavedSearchRequestSchema }),
  z.object({ op: z.literal('getPageContext') }),
  z.object({ op: z.literal('readImpactSource'), request: ImpactSourceRequestSchema }),
  z.object({ op: z.literal('callRestlet'), request: RestletRequestSchema }),
  z.object({ op: z.literal('runConsoleQuery'), ...ConsoleRequestFields }),
  z.object({ op: z.literal('getRecordFields'), ref: RecordRefSchema }),
  z.object({
    op: z.literal('getRecordXml'),
    comparison: z.literal(true).optional(),
    ref: RecordRefSchema,
    accountId: PageContextSchema.shape.accountId,
  }),
  z.object({ op: z.literal('runQuery'), queryId: QueryIdSchema, variantId: VariantIdSchema }),
  // Visual only: scrolls to a field label in the page and outlines it briefly. No writes.
  z.object({ op: z.literal('highlightField'), fieldId: FieldIdSchema }),
]);
export type ContentRequest = z.infer<typeof ContentRequestSchema>;

export const RowsSchema = z.array(z.record(z.string(), z.unknown())).max(5000);

export const ContentResponseSchemas = {
  discoverImpactSavedSearches: resultSchema(SearchDiscoverySchema),
  readImpactPdfEditor: resultSchema(PdfEditorSourceSchema),
  readImpactSavedSearch: resultSchema(ImpactSavedSearchSchema),
  getPageContext: resultSchema(PageContextSchema),
  readImpactSource: resultSchema(ImpactSourceSchema),
  callRestlet: resultSchema(RestletResponseSchema),
  getRecordFields: resultSchema(RecordFieldsResultSchema),
  getRecordXml: resultSchema(z.string().max(MAX_RECORD_XML_LENGTH)),
  runQuery: resultSchema(RowsSchema),
  runConsoleQuery: resultSchema(ConsoleResultSchema),
  highlightField: resultSchema(z.boolean()),
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
const FieldIdListSchema = z.array(FieldIdSchema).max(1000);
const SublistRequestSchema = z
  .array(z.object({ id: FieldIdSchema, fieldIds: z.array(FieldIdSchema).max(300) }))
  .max(50);

export const BridgeOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('readImpactSavedSearch'), searchId: SavedSearchIdSchema }),
  z.object({ op: z.literal('ping') }),
  z.object({ op: z.literal('runConsoleQuery'), ...ConsoleRequestFields }),
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
  readImpactSavedSearch: SavedSearchDefinitionSchema,
  runConsoleQuery: ConsoleRowsSchema,
  ping: z.object({ requireAvailable: z.boolean() }),
  getRecordType: z.object({
    recordType: z.string().nullable(),
    recordId: z.string().nullable(),
  }),
  getCurrentRecordFields: CurrentRecordFieldsSchema,
  getLoadedRecordFields: CurrentRecordFieldsSchema,
  runSuiteQL: RowsSchema,
} as const;

/**
 * AI Assist (PRD-05, ADR 0041): side panel ⇄ background over a long-lived
 * `runtime.connect` port named {@link AI_PORT_NAME}. One port carries one request.
 * Closing the port (or sending `cancel`) aborts the provider call.
 */
export const AI_PORT_NAME = 'suitelens:ai';

export const AiPortClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), request: AiRequestSchema }),
  z.object({ type: z.literal('cancel') }),
]);
export type AiPortClientMessage = z.infer<typeof AiPortClientMessageSchema>;

export const AiPortServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('done'),
    usage: AiUsageSchema,
    stopReason: z.string().optional(),
  }),
  z.object({ type: z.literal('error'), error: SuiteLensErrorShapeSchema }),
]);
export type AiPortServerMessage = z.infer<typeof AiPortServerMessageSchema>;

// Local MCP boundary contracts are shared with the separately packaged native host.
export {
  McpControlSchema,
  McpControlResponseSchema,
  McpStateSchema,
  NativeRequestSchema,
  NativeResponseSchema,
} from '../../../packages/mcp-bridge/src/protocol';
