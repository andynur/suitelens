import { z } from 'zod';
import { detectFromUrl } from '../context/detect';
import { SuiteLensError } from '../errors';
import { SOURCE_LIMITS, validateSourceContent } from './source';

export const PdfEditorRequestSchema = z
  .object({
    accountId: z.string().min(1).max(100),
    /** URL editor context, not a File Cabinet ID or a persisted template identity. */
    editorId: z.string().regex(/^(?:0|[1-9][0-9]{0,19})$/),
  })
  .strict();
export type PdfEditorRequest = z.infer<typeof PdfEditorRequestSchema>;
export const PdfEditorSourceSchema = PdfEditorRequestSchema.extend({
  templateId: z
    .string()
    .regex(/^[1-9][0-9]{0,19}$/)
    .optional(),
  state: z.enum(['unsaved', 'existing']),
  url: z.string().url().max(4096),
  content: z.string().max(SOURCE_LIMITS.characters),
})
  .strict()
  .refine((value) =>
    value.state === 'existing'
      ? value.templateId === value.editorId && value.templateId !== undefined
      : value.templateId === undefined,
  );
export type PdfEditorSource = z.infer<typeof PdfEditorSourceSchema>;

const PATH = '/app/common/custom/advancedprint/pdftemplate.nl';
const PARAMETERS = [
  'id',
  'nl',
  'tt',
  'pt',
  'source',
  'savedsearchid',
  'rt',
  'e',
  'sc',
  'ifrmcntnr',
];
export const PDF_EDITOR_HELP =
  'Open the Advanced PDF/HTML template editor and select Source Code. The editor source was not checked.';
const unsupported = () => new SuiteLensError('UNSUPPORTED', PDF_EDITOR_HELP, PDF_EDITOR_HELP);

/** Recognize only an actual editor URL. Never construct a template endpoint or fetch it. */
export function pdfEditorId(pageUrl: string): string | undefined {
  try {
    const url = new URL(pageUrl);
    const id = url.searchParams.get('id');
    if (
      !detectFromUrl(pageUrl) ||
      url.pathname !== PATH ||
      url.username ||
      url.password ||
      url.hash ||
      url.href.length > 4096 ||
      !id ||
      !PdfEditorRequestSchema.shape.editorId.safeParse(id).success ||
      [...url.searchParams.keys()].some(
        (key) => !PARAMETERS.includes(key) || url.searchParams.getAll(key).length !== 1,
      )
    )
      return undefined;
    return id;
  } catch {
    return undefined;
  }
}

export function validatePdfEditorSource(
  raw: PdfEditorSource,
  pageUrl: string,
  request: PdfEditorRequest,
): PdfEditorSource {
  const source = PdfEditorSourceSchema.parse(raw);
  if (detectFromUrl(pageUrl)?.accountId !== request.accountId)
    throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed during the PDF editor read.');
  if (
    source.accountId !== request.accountId ||
    source.editorId !== request.editorId ||
    source.url !== pageUrl ||
    pdfEditorId(source.url) !== request.editorId
  )
    throw new SuiteLensError(
      'INVALID_RESPONSE',
      'PDF editor response does not match the active editor.',
    );
  if (new TextEncoder().encode(source.content).byteLength > SOURCE_LIMITS.bytes)
    throw new SuiteLensError('UNSUPPORTED', 'PDF editor source exceeds the read limit.');
  validateSourceContent(source.content, 'pdf-template');
  return source;
}

/** Snapshot only: reads current XML, including unsaved edits; never parses or renders XML. */
export function readPdfEditor(
  doc: Document,
  pageUrl: string,
  request: PdfEditorRequest,
): PdfEditorSource {
  if (detectFromUrl(pageUrl)?.accountId !== request.accountId)
    throw new SuiteLensError('ACCOUNT_MISMATCH', 'Account changed before the PDF editor read.');
  if (pdfEditorId(pageUrl) !== request.editorId) throw unsupported();
  // VERIFY: observed in one sandbox standard customization. Saved editors and restricted roles
  // still need live validation. Missing/ambiguous mode or identity fails closed.
  const areas = doc.querySelectorAll<HTMLTextAreaElement>(
    'textarea#source-template[name="source-template"]',
  );
  const ids = doc.querySelectorAll<HTMLInputElement>('input#pdftemplate-id[type="hidden"]');
  const modes = doc.querySelectorAll<HTMLInputElement>(
    'input#pdftemplate-not-show-source[type="hidden"]',
  );
  if (areas.length !== 1 || ids.length !== 1 || modes.length !== 1 || modes[0]!.value !== 'F')
    throw unsupported();
  const templateId = ids[0]!.value;
  const unsaved = templateId === '-1';
  if (!unsaved && (!/^[1-9][0-9]{0,19}$/.test(templateId) || templateId !== request.editorId))
    throw unsupported();
  const url = new URL(pageUrl);
  if (!unsaved && (url.searchParams.get('nl') === 'T' || url.searchParams.get('source') === 'F'))
    throw unsupported();
  if (
    areas[0]!.value.length > SOURCE_LIMITS.characters ||
    new TextEncoder().encode(areas[0]!.value).byteLength > SOURCE_LIMITS.bytes
  )
    throw new SuiteLensError('UNSUPPORTED', 'PDF editor source exceeds the read limit.');
  return validatePdfEditorSource(
    {
      ...request,
      state: unsaved ? 'unsaved' : 'existing',
      ...(unsaved ? {} : { templateId }),
      url: pageUrl,
      content: areas[0]!.value,
    },
    pageUrl,
    request,
  );
}
