import { z } from 'zod';

/**
 * Domain types shared by every context. Schemas are the source of truth so the same
 * definitions validate data at each context boundary (see bridge/protocol.ts).
 * This module must stay free of browser/extension APIs (future packages/core).
 */

export const EnvironmentSchema = z.enum(['production', 'sandbox', 'release_preview', 'unknown']);
export type Environment = z.infer<typeof EnvironmentSchema>;

export const PageKindSchema = z.enum([
  'record_view',
  'record_edit',
  'record_create',
  'list',
  'search',
  'other',
]);
export type PageKind = z.infer<typeof PageKindSchema>;

export const PageContextSchema = z.object({
  /** From the hostname, e.g. "1234567" or "1234567-sb1". Lowercase. */
  accountId: z.string().min(1),
  environment: EnvironmentSchema,
  pageKind: PageKindSchema,
  /** SuiteScript record type ID, e.g. "salesorder", "customrecord_xyz". */
  recordType: z.string().optional(),
  recordId: z.string().optional(),
  /** Numeric custom record type ID from `rectype=` when the script ID is not known. */
  customRecordTypeId: z.string().optional(),
  /** Which signal produced `recordType`. */
  recordTypeSource: z.enum(['url', 'dom', 'bridge']).optional(),
  url: z.string(),
  detectedAt: z.number(),
});
export type PageContext = z.infer<typeof PageContextSchema>;

export const RecordRefSchema = z.object({
  recordType: z.string().min(1),
  id: z.string().optional(),
});
export type RecordRef = z.infer<typeof RecordRefSchema>;

export const FieldSourceSchema = z.enum(['xml', 'dom', 'currentRecord']);
export type FieldSource = z.infer<typeof FieldSourceSchema>;

export const RecordFieldInfoSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  /** NetSuite field type (e.g. "select", "text"); undefined when no source provided it. */
  type: z.string().optional(),
  /** Value rendered as text. Never inserted into the DOM as HTML. */
  value: z.string().optional(),
  mandatory: z.boolean().optional(),
  disabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
  custom: z.boolean(),
  sources: z.array(FieldSourceSchema),
});
export type RecordFieldInfo = z.infer<typeof RecordFieldInfoSchema>;

export const SublistInfoSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  lineCount: z.number().int().nonnegative(),
  fields: z.array(RecordFieldInfoSchema),
});
export type SublistInfo = z.infer<typeof SublistInfoSchema>;

export const RecordFieldsResultSchema = z.object({
  accountId: z.string(),
  recordType: z.string(),
  recordId: z.string().optional(),
  fields: z.array(RecordFieldInfoSchema),
  sublists: z.array(SublistInfoSchema),
  /** Which data sources contributed (shown in the UI, F-1.10). */
  sources: z.array(FieldSourceSchema),
  warnings: z.array(z.string()),
  fetchedAt: z.number(),
});
export type RecordFieldsResult = z.infer<typeof RecordFieldsResultSchema>;

export const AutomationKindSchema = z.enum(['client', 'user_event', 'workflow_action', 'workflow']);
export type AutomationKind = z.infer<typeof AutomationKindSchema>;

export const AutomationItemSchema = z.object({
  kind: AutomationKindSchema,
  name: z.string(),
  /** Script or workflow internal ID. */
  internalId: z.string(),
  /** Script/workflow script ID, e.g. "customscript_x". */
  scriptId: z.string().optional(),
  deploymentInternalId: z.string().optional(),
  deploymentId: z.string().optional(),
  /** Raw status text from NetSuite (e.g. "RELEASED", "TESTING"). */
  status: z.string().optional(),
  isDeployed: z.boolean().optional(),
  isInactive: z.boolean().optional(),
  logLevel: z.string().optional(),
  executionContexts: z.array(z.string()).optional(),
  trigger: z.string().optional(),
  scriptFileId: z.string().optional(),
  scriptFileName: z.string().optional(),
});
export type AutomationItem = z.infer<typeof AutomationItemSchema>;

export const AutomationResultSchema = z.object({
  accountId: z.string(),
  recordType: z.string(),
  items: z.array(AutomationItemSchema),
  /** False when some optional columns/queries were unavailable: order is approximate. */
  complete: z.boolean(),
  warnings: z.array(z.string()),
  fetchedAt: z.number(),
});
export type AutomationResult = z.infer<typeof AutomationResultSchema>;
