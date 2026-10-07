import { z } from 'zod';
import { isValidAccountId } from '../context/environment';
import { SuiteLensError } from '../errors';

export const SAVED_SEARCH_LIMITS = {
  members: 500,
  formulaCharacters: 20_000,
  characters: 2_000_000,
  timeoutMs: 15_000,
} as const;
export const SavedSearchIdSchema = z
  .string()
  .max(128)
  .regex(/^(?:[1-9][0-9]{0,19}|customsearch[a-z0-9_]*)$/);
export const ImpactSavedSearchRequestSchema = z
  .object({
    accountId: z.string().refine(isValidAccountId),
    searchId: SavedSearchIdSchema,
  })
  .strict();
export type ImpactSavedSearchRequest = z.infer<typeof ImpactSavedSearchRequestSchema>;

const MemberSchema = z
  .object({
    name: z.string().min(1).max(128),
    join: z.string().max(128).optional(),
    formula: z.string().max(SAVED_SEARCH_LIMITS.formulaCharacters).optional(),
  })
  .strict();
export const SavedSearchDefinitionSchema = z
  .object({
    internalId: z.string().regex(/^[1-9][0-9]{0,19}$/),
    scriptId: SavedSearchIdSchema.optional(),
    title: z.string().min(1).max(512),
    isPublic: z.boolean().optional(),
    filters: z.array(MemberSchema).max(SAVED_SEARCH_LIMITS.members),
    columns: z.array(MemberSchema).max(SAVED_SEARCH_LIMITS.members),
  })
  .strict()
  .refine((definition) => JSON.stringify(definition).length <= SAVED_SEARCH_LIMITS.characters);
export type SavedSearchDefinition = z.infer<typeof SavedSearchDefinitionSchema>;
export const ImpactSavedSearchSchema = ImpactSavedSearchRequestSchema.extend({
  definition: SavedSearchDefinitionSchema,
  objectUrl: z.string().url().max(4096).optional(),
}).strict();
export type ImpactSavedSearch = z.infer<typeof ImpactSavedSearchSchema>;

/** Project only documented definition members. Never read filter values or run results. */
export function mapSavedSearchDefinition(raw: unknown, requestedId: string): SavedSearchDefinition {
  if (!raw || typeof raw !== 'object')
    throw new SuiteLensError('INVALID_RESPONSE', 'Saved search definition is unavailable.');
  const search = raw as Record<string, unknown>;
  const projectMembers = (value: unknown, allowNames = false) => {
    if (!Array.isArray(value) || value.length > SAVED_SEARCH_LIMITS.members)
      throw new SuiteLensError('UNSUPPORTED', 'Saved search definition exceeds supported limits.');
    return value.map((member: unknown) => {
      if (allowNames && typeof member === 'string') return { name: member };
      if (!member || typeof member !== 'object')
        throw new SuiteLensError('INVALID_RESPONSE', 'Invalid saved search member.');
      const entry = member as Record<string, unknown>;
      return {
        name: entry.name,
        ...(entry.join != null && entry.join !== '' ? { join: entry.join } : {}),
        ...(entry.formula != null && entry.formula !== '' ? { formula: entry.formula } : {}),
      };
    });
  };
  const parsed = SavedSearchDefinitionSchema.safeParse({
    internalId:
      typeof search.searchId === 'number' && Number.isSafeInteger(search.searchId)
        ? String(search.searchId)
        : search.searchId,
    ...(search.id != null && search.id !== '' ? { scriptId: search.id } : {}),
    title: search.title,
    ...(search.isPublic != null ? { isPublic: search.isPublic } : {}),
    filters: projectMembers(search.filters),
    columns: projectMembers(search.columns, true),
  });
  if (!parsed.success)
    throw new SuiteLensError('INVALID_RESPONSE', 'Invalid or oversized saved search definition.');
  const definition = parsed.data;
  if (
    /^[0-9]+$/.test(requestedId)
      ? definition.internalId !== requestedId
      : definition.scriptId !== requestedId
  )
    throw new SuiteLensError(
      'INVALID_RESPONSE',
      'Saved search identity does not match the request.',
    );
  return definition;
}

/** Resolve only an observed definition link; no guessed search URL or hidden export API. */
export function observedSavedSearchId(href: string, pageUrl: string): string | undefined {
  try {
    const page = new URL(pageUrl);
    const url = new URL(href, pageUrl);
    const id = url.searchParams.get('id');
    if (
      url.protocol === 'https:' &&
      url.origin === page.origin &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.pathname === '/app/common/search/search.nl' &&
      url.href.length <= 4096 &&
      url.searchParams.getAll('id').length === 1 &&
      id &&
      /^[1-9][0-9]{0,19}$/.test(id) &&
      [...url.searchParams.keys()].every((key) => ['id', 'e', 'whence'].includes(key)) &&
      url.searchParams.getAll('e').length <= 1 &&
      (!url.searchParams.has('e') || ['T', 'F'].includes(url.searchParams.get('e')!))
    )
      return id;
  } catch {
    /* Ignore malformed or unrelated links. */
  }
  return undefined;
}

export function findSavedSearchLink(
  doc: Document,
  pageUrl: string,
  internalId: string,
): string | undefined {
  // VERIFY: observed saved-search definition links vary by account; absence is not a read failure.
  for (const href of [
    pageUrl,
    ...Array.from(doc.querySelectorAll('a[href]'), (anchor) => anchor.getAttribute('href')!),
  ]) {
    if (observedSavedSearchId(href, pageUrl) === internalId) return new URL(href, pageUrl).href;
  }
  return undefined;
}

export async function loadSavedSearchDefinition(
  module: unknown,
  searchId: string,
): Promise<SavedSearchDefinition> {
  const search = module as
    { load?: { promise?: (options: { id: string }) => Promise<unknown> } } | undefined;
  if (typeof search?.load?.promise !== 'function')
    throw new SuiteLensError(
      'MODULE_UNAVAILABLE',
      'N/search.load.promise is unavailable on this page.',
    );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Oracle documents load.promise for client scripts; VERIFY role access in the active account.
    const definition = await Promise.race([
      search.load.promise({ id: searchId }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new SuiteLensError('TIMEOUT', 'Saved search read timed out.')),
          SAVED_SEARCH_LIMITS.timeoutMs,
        );
      }),
    ]);
    return mapSavedSearchDefinition(definition, searchId);
  } catch (error) {
    if (error instanceof SuiteLensError) throw error;
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
    // VERIFY: error names depend on role visibility; never expose raw exceptions or definitions.
    throw new SuiteLensError(
      /permission|access|authori[sz]/i.test(name) ? 'PERMISSION_DENIED' : 'UNSUPPORTED',
      'The saved search definition could not be read. Standalone search types are not supported.',
    );
  } finally {
    clearTimeout(timer);
  }
}
