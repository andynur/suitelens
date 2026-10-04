/** 128-bit random nonce, hex encoded (32 chars). Created per tab by the content script. */
type Bytes = Uint8Array<ArrayBuffer>;

export function createNonce(random: (bytes: Bytes) => Bytes = defaultRandom): string {
  const bytes = random(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function defaultRandom(bytes: Bytes): Bytes {
  return crypto.getRandomValues(bytes);
}

/** Constant-time string comparison for nonces. */
export function nonceEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
