import { browser } from 'wxt/browser';
import { z } from 'zod';
import type { AiProviderId } from '../../features/ai/catalog';

/**
 * Secure storage for BYOK AI API keys (CLAUDE.md rule 3, ADR 0041, ADR 0043). The only module
 * that reads or writes a key. One key per provider:
 *   storage.local   `secret:ai:<provider>`          AES-GCM ciphertext; key derived from a
 *                                                    passphrase
 *   storage.session `secret:ai:session:<provider>`  unlocked or session-only key (cleared on
 *                                                    browser exit, not readable by content
 *                                                    scripts)
 * The passphrase is never stored. Never log the key or the passphrase.
 */
export type AiKeyMode = 'encrypted' | 'session';
export type AiKeyInfo = { stored: 'none' | AiKeyMode; unlocked: boolean };

/** Prefix of every AI key entry, in both storage areas. */
export const AI_SECRET_PREFIX = 'secret:ai:';
export const aiSecretKey = (provider: AiProviderId) => `${AI_SECRET_PREFIX}${provider}`;
export const aiSessionKey = (provider: AiProviderId) => `${AI_SECRET_PREFIX}session:${provider}`;
export const MIN_PASSPHRASE_LENGTH = 8;
const PBKDF2_ITERATIONS = 310_000;

const ApiKeySchema = z
  .string()
  .trim()
  .min(8, 'The API key is too short.')
  .max(512, 'The API key is too long.')
  .regex(/^\S+$/, 'The API key must not contain spaces.');

const PassphraseSchema = z
  .string()
  .min(MIN_PASSPHRASE_LENGTH, `Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`)
  .max(1024);

const Base64Schema = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);
const EncryptedBlobSchema = z.object({
  v: z.literal(1),
  iterations: z.number().int().min(100_000).max(10_000_000),
  salt: Base64Schema,
  iv: Base64Schema,
  data: Base64Schema,
});
type EncryptedBlob = z.infer<typeof EncryptedBlobSchema>;

const SessionEntrySchema = z.object({
  key: ApiKeySchema,
  mode: z.enum(['encrypted', 'session']),
});

export async function saveAiKey(
  provider: AiProviderId,
  key: string,
  options: { mode: 'session' } | { mode: 'encrypted'; passphrase: string },
): Promise<void> {
  const apiKey = parseOrThrow(ApiKeySchema, key);
  if (options.mode === 'encrypted') {
    const blob = await encrypt(apiKey, parseOrThrow(PassphraseSchema, options.passphrase));
    await browser.storage.local.set({ [aiSecretKey(provider)]: blob });
  } else {
    // Session-only: no persistent copy may remain from an earlier "remember" choice.
    await browser.storage.local.remove(aiSecretKey(provider));
  }
  await browser.storage.session.set({
    [aiSessionKey(provider)]: { key: apiKey, mode: options.mode },
  });
}

/** Decrypts the remembered key into session storage. Throws on a wrong passphrase. */
export async function unlockAiKey(provider: AiProviderId, passphrase: string): Promise<void> {
  const blob = await readBlob(provider);
  if (!blob) throw new Error('No saved AI key to unlock.');
  const key = await decrypt(blob, passphrase);
  await browser.storage.session.set({ [aiSessionKey(provider)]: { key, mode: 'encrypted' } });
}

/** Forgets the unlocked copy; a remembered (encrypted) key stays. */
export async function lockAiKey(provider: AiProviderId): Promise<void> {
  await browser.storage.session.remove(aiSessionKey(provider));
}

/** Removes every copy of the key. */
export async function deleteAiKey(provider: AiProviderId): Promise<void> {
  await Promise.all([
    browser.storage.local.remove(aiSecretKey(provider)),
    browser.storage.session.remove(aiSessionKey(provider)),
  ]);
}

export async function getAiKeyInfo(provider: AiProviderId): Promise<AiKeyInfo> {
  const [blob, session] = await Promise.all([readBlob(provider), readSession(provider)]);
  if (blob) return { stored: 'encrypted', unlocked: session !== undefined };
  if (session?.mode === 'session') return { stored: 'session', unlocked: true };
  return { stored: 'none', unlocked: false };
}

/** Background worker only. */
export async function getUnlockedAiKey(provider: AiProviderId): Promise<string | undefined> {
  return (await readSession(provider))?.key;
}

async function readBlob(provider: AiProviderId): Promise<EncryptedBlob | undefined> {
  const name = aiSecretKey(provider);
  const stored = await browser.storage.local.get(name);
  const parsed = EncryptedBlobSchema.safeParse(stored[name]);
  return parsed.success ? parsed.data : undefined;
}

async function readSession(
  provider: AiProviderId,
): Promise<z.infer<typeof SessionEntrySchema> | undefined> {
  const name = aiSessionKey(provider);
  const stored = await browser.storage.session.get(name);
  const parsed = SessionEntrySchema.safeParse(stored[name]);
  return parsed.success ? parsed.data : undefined;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(apiKey: string, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(apiKey),
  );
  return {
    v: 1,
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  };
}

async function decrypt(blob: EncryptedBlob, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, fromBase64(blob.salt), blob.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(blob.iv) as BufferSource },
      key,
      fromBase64(blob.data) as BufferSource,
    );
  } catch {
    // AES-GCM authentication failure: wrong passphrase or tampered data.
    throw new Error('Wrong passphrase.');
  }
  return parseOrThrow(ApiKeySchema, new TextDecoder().decode(plain));
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid value.');
  return parsed.data;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
