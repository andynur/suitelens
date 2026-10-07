import { browser } from 'wxt/browser';
import { z } from 'zod';
import {
  RestletRequestSchema,
  validateRestletRequest,
  assertNoCredentials,
  type RestletRequest,
} from '../../netsuite/restlets/request';
import { accountKey } from './settings';

const PresetsSchema = z.object({
  sandbox: z.record(z.string(), z.string()),
  production: z.record(z.string(), z.string()),
});
const CollectionSchema = z.object({
  requests: z
    .array(z.object({ name: z.string().min(1).max(80), request: RestletRequestSchema }))
    .max(50),
  presets: PresetsSchema,
});
export type RestletCollection = z.infer<typeof CollectionSchema>;
export const emptyCollection = (): RestletCollection => ({
  requests: [],
  presets: { sandbox: {}, production: {} },
});
export async function getRestletCollection(accountId: string): Promise<RestletCollection> {
  const key = accountKey(accountId, 'restlets');
  const parsed = CollectionSchema.safeParse((await browser.storage.local.get(key))[key]);
  if (!parsed.success) return emptyCollection();
  assertNoCredentials(parsed.data.presets);
  for (const item of parsed.data.requests) {
    validateRestletRequest(item.request);
    if (item.request.accountId !== accountId) throw new Error('Collection account mismatch');
  }
  return parsed.data;
}
export async function saveRestletCollection(accountId: string, raw: RestletCollection) {
  const collection = CollectionSchema.parse(raw);
  assertNoCredentials(collection.presets);
  for (const item of collection.requests) {
    validateRestletRequest(item.request);
    if (item.request.accountId !== accountId) throw new Error('Collection account mismatch');
    item.request.confirmed = false;
  }
  await browser.storage.local.set({ [accountKey(accountId, 'restlets')]: collection });
}
export function resolveRequestVariables(
  req: RestletRequest,
  variables: Record<string, string>,
): RestletRequest {
  const replace = (value: string) =>
    value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, name: string) => {
      if (!Object.hasOwn(variables, name)) throw new Error(`Missing variable: ${name}`);
      return variables[name]!;
    });
  const pairs = (input: Record<string, string>) =>
    Object.fromEntries(Object.entries(input).map(([key, value]) => [key, replace(value)]));
  return validateRestletRequest({
    ...req,
    params: pairs(req.params),
    headers: pairs(req.headers),
    body: replace(req.body),
    confirmed: false,
  });
}
